export interface PhotoShare {
  /**
   * Open the system share sheet for a local image URI (Messages, AirDrop,
   * Save Image, Files, etc.). Throws only when the platform cannot share.
   */
  share(uri: string): Promise<void>;

  /**
   * Copy a local image into the device photo library. Asks for add-only
   * permission the first time. Throws when permission is denied or save fails.
   */
  saveToLibrary(uri: string): Promise<void>;
}
