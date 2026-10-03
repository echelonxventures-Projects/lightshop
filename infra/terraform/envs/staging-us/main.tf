# Example composition. Swap the module source to change cloud; inputs stay the same.
module "cell" {
  source       = "../../providers/aws" # or ../../providers/gcp, ../../providers/azure, ../../providers/on-prem
  region_code  = "us"
  cloud_region = "us-east-1"
  environment  = "staging"
}
