package com.loc.electricity.infrastructure.storage;

public interface FileStorageService {
    /** Stores data at the given relative path under upload dir. Returns the relative path. */
    String store(byte[] data, String relativePath);

    /**
     * Loads data from the given relative path under the upload directory.
     *
     * @param relativePath the relative path previously returned by {@link #store}
     * @return the file contents as a byte array
     * @throws RuntimeException if the file does not exist or cannot be read
     */
    byte[] load(String relativePath);
}
