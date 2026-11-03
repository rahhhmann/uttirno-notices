#!/bin/sh
set -eu
awslocal s3api head-bucket --bucket uttirno-dev-artifacts 2>/dev/null || awslocal s3api create-bucket --bucket uttirno-dev-artifacts
