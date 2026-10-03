# Remote state per cell. Configure at init:
#   terraform init -backend-config="bucket=<state-bucket>" -backend-config="key=lightshop/<env>/<cell>.tfstate" -backend-config="region=<region>"
terraform {
  backend "s3" {}
}
