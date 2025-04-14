export default (): {
  storage: {
    s3Bucket: string
    s3Endpoint: string
    s3Region: string
    s3AccessKeyId: string
    s3SecretAccessKey: string
    s3Provider: string
  }
} => {
  return {
    storage: {
      s3Bucket: process.env.S3_BUCKET,
      s3Endpoint: process.env.S3_ENDPOINT,
      s3Region: process.env.S3_REGION,
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      s3Provider: process.env.S3_PROVIDER,
    }
  }
}
