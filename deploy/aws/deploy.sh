#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STACK_NAME="${STACK_NAME:-manifest}"
SERVICE_NAME="${SERVICE_NAME:-manifest}"
IMAGE_URL="${IMAGE_URL:-docker.io/manifestdotbuild/manifest:6}"
DESIRED_COUNT="${DESIRED_COUNT:-1}"
DATABASE_INSTANCE_CLASS="${DATABASE_INSTANCE_CLASS:-db.t4g.micro}"
DATABASE_DELETION_PROTECTION="${DATABASE_DELETION_PROTECTION:-false}"
TEMPLATE_FILE="${TEMPLATE_FILE:-$SCRIPT_DIR/manifest.yaml}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"

if [[ -z "$REGION" ]]; then
  REGION="$(aws configure get region 2>/dev/null || true)"
fi

if [[ -z "$REGION" ]]; then
  echo "Set AWS_REGION or configure a default AWS CLI region." >&2
  exit 1
fi

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    ServiceName="$SERVICE_NAME" \
    ImageUrl="$IMAGE_URL" \
    DesiredCount="$DESIRED_COUNT" \
    DatabaseInstanceClass="$DATABASE_INSTANCE_CLASS" \
    DatabaseDeletionProtection="$DATABASE_DELETION_PROTECTION"

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl' || OutputKey=='HealthCheckUrl'].[OutputKey,OutputValue]" \
  --output table
