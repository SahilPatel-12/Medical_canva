import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { S3StorageDriver } from "../src/s3Driver.js";

describe("Live Cloudflare R2 Storage Audit", () => {
  const driver = new S3StorageDriver({
    driver: "r2",
    endpoint: "https://2c91ec3e8bbe84328ecbd409f15edb82.r2.cloudflarestorage.com",
    bucket: "medicalcanvas",
    region: "auto",
    accessKey: "8efa03a8db53cc0387ee473f1ffe816f",
    secretKey: "50c8679d7e8bb15f41787f6e62a9db502cb07d36d9e34f178c15892a2d18e605",
    publicUrl: "https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev",
  });

  test("R2 connectivity, bucket existence and listFiles", async () => {
    assert.ok(driver, "Driver must initialize");

    const files = await driver.listFiles("assets/");
    console.log(`Cloudflare R2 'medicalcanvas' bucket connected! Total objects with prefix 'assets/': ${files.length}`);
    console.log("Sample objects in R2:", files.slice(0, 5));
    assert.ok(Array.isArray(files), "Files must be an array");
  });

  test("R2 public URL format check", () => {
    const url = driver.getPublicUrl("assets/science/dna-double-helix.svg");
    assert.equal(url, "https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/dna-double-helix.svg");
  });
});
