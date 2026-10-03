/** Port for blob storage. The default adapter speaks the S3 API (SeaweedFS, Garage, Ceph, R2, S3, GCS-interop). */
export interface ObjectStorage {
  readonly id: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<{ key: string; url: string }>;
  signedGetUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
