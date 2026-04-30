package com.loc.electricity.infrastructure.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@Slf4j
public class LocalFileStorageService implements FileStorageService {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public String store(byte[] data, String relativePath) {
        try {
            Path target = Paths.get(uploadDir).resolve(relativePath);
            Files.createDirectories(target.getParent());
            Files.write(target, data);
            log.debug("Stored file: {}", target);
            return relativePath;
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store file: " + relativePath, e);
        }
    }

    @Override
    public byte[] load(String relativePath) {
        try {
            return Files.readAllBytes(Paths.get(uploadDir).resolve(relativePath));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read file: " + relativePath, e);
        }
    }
}
