# Remote state per cell: any backend works (s3-compatible, pg, http, consul...). Example with Postgres:
#   terraform init -backend-config="conn_str=postgres://.../terraform" -backend-config="schema_name=lightshop_<env>_<cell>"
terraform {
  backend "pg" {}
}
