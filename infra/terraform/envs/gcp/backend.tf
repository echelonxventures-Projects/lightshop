# Remote state per cell: terraform init -backend-config="bucket=<state-bucket>" -backend-config="prefix=lightshop/<env>/<cell>"
terraform {
  backend "gcs" {}
}
