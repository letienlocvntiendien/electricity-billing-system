package com.loc.electricity.infrastructure.storage;

public interface FileStorageService {
    /** Stores data at the given relative path under upload dir. Returns the relative path. */
    String store(byte[] data, String relativePath);

    byte[] load(String relativePath);
}
