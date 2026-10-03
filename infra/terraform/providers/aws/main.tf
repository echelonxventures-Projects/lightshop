locals {
  name = "${var.name_prefix}-${var.environment}-${var.cell}"
  tags = merge(var.tags, {
    "lightshop:cell"        = var.cell
    "lightshop:environment" = var.environment
    "lightshop:managed-by"  = "terraform"
  })
  # Provider-neutral size classes → AWS instance types.
  node_types = { small = "m7i.large", medium = "m7i.xlarge", large = "m7i.2xlarge", xlarge = "m7i.4xlarge" }
  db_classes = { small = "db.m7g.large", medium = "db.m7g.xlarge", large = "db.m7g.2xlarge", xlarge = "db.m7g.4xlarge" }
  azs        = slice(data.aws_availability_zones.available.names, 0, var.aws_availability_zones)
}

data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.21"

  name                   = local.name
  cidr                   = var.aws_vpc_cidr
  azs                    = local.azs
  private_subnets        = [for i, _ in local.azs : cidrsubnet(var.aws_vpc_cidr, 4, i)]
  public_subnets         = [for i, _ in local.azs : cidrsubnet(var.aws_vpc_cidr, 8, 200 + i)]
  database_subnets       = [for i, _ in local.azs : cidrsubnet(var.aws_vpc_cidr, 8, 210 + i)]
  enable_nat_gateway     = true
  one_nat_gateway_per_az = var.environment == "production"
  single_nat_gateway     = var.environment != "production"
  private_subnet_tags    = { "kubernetes.io/role/internal-elb" = "1" }
  public_subnet_tags     = { "kubernetes.io/role/elb" = "1" }
  tags                   = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.37"

  cluster_name                             = local.name
  cluster_version                          = var.kubernetes_version
  vpc_id                                   = module.vpc.vpc_id
  subnet_ids                               = module.vpc.private_subnets
  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true
  enable_irsa                              = true

  eks_managed_node_groups = {
    for pool, cfg in var.node_pools : pool => {
      instance_types = [local.node_types[cfg.instance_size]]
      min_size       = cfg.min_nodes
      max_size       = cfg.max_nodes
      desired_size   = cfg.min_nodes
      labels         = { "lightshop/pool" = pool }
    }
  }
  tags = local.tags
}

resource "aws_security_group" "postgres" {
  count       = var.managed_postgres.enabled ? 1 : 0
  name        = "${local.name}-postgres"
  description = "Postgres reachable only from the cell cluster nodes"
  vpc_id      = module.vpc.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
  tags = local.tags
}

resource "aws_db_instance" "postgres" {
  count                        = var.managed_postgres.enabled ? 1 : 0
  identifier                   = local.name
  engine                       = "postgres"
  engine_version               = var.managed_postgres.version
  instance_class               = local.db_classes[var.managed_postgres.instance_size]
  allocated_storage            = 100
  max_allocated_storage        = 2000
  storage_encrypted            = true
  multi_az                     = var.managed_postgres.high_available
  db_subnet_group_name         = module.vpc.database_subnet_group_name
  vpc_security_group_ids       = [aws_security_group.postgres[0].id]
  username                     = "lightshop_admin"
  manage_master_user_password  = true # stored in AWS Secrets Manager; wire via External Secrets
  backup_retention_period      = var.managed_postgres.backup_days
  deletion_protection          = var.environment == "production"
  skip_final_snapshot          = var.environment != "production"
  final_snapshot_identifier    = "${local.name}-final"
  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
  copy_tags_to_snapshot        = true
  tags                         = local.tags
}

resource "aws_s3_bucket" "media" {
  count  = var.object_storage.enabled ? 1 : 0
  bucket = "${local.name}-media"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "media" {
  count  = var.object_storage.enabled ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  versioning_configuration {
    status = var.object_storage.versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  count                   = var.object_storage.enabled ? 1 : 0
  bucket                  = aws_s3_bucket.media[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  count  = var.object_storage.enabled ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}
