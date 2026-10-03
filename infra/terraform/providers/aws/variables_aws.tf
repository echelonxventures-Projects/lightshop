variable "aws_vpc_cidr" {
  description = "VPC CIDR for this cell."
  type        = string
  default     = "10.40.0.0/16"
}

variable "aws_availability_zones" {
  description = "AZs to spread the cell across (3 recommended)."
  type        = number
  default     = 3
}
