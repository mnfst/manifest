export function makeShortTermBedrockKey(region: string): string {
  const payload =
    'bedrock.amazonaws.com/?Action=CallWithBearerToken&' +
    `X-Amz-Credential=ASIAEXAMPLE%2F20260612%2F${region}%2Fbedrock%2Faws4_request`;
  return `bedrock-api-key-${Buffer.from(payload).toString('base64')}`;
}
