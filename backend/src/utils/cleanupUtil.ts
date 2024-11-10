import { unlink, readdir } from "fs/promises";
import path from "path";

class CleanupService {
  private async cleanup(): Promise<void> {
    try {
      const tempDir = path.join(__dirname, "..", "tmp");

      try {
        await readdir(tempDir);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          console.log("No temp directory found, skipping cleanup");
          return;
        }
        throw error;
      }

      const files = await readdir(tempDir);
      if (files.length === 0) {
        console.log("No temporary files to clean up");
        return;
      }

      await Promise.all(
        files.map(async (file) => {
          try {
            await unlink(path.join(tempDir, file));
          } catch (error) {
            console.error(`Failed to delete file ${file}:`, error);
          }
        })
      );

      console.log(`Cleaned up ${files.length} temporary files`);
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }

  private handleShutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      await this.cleanup();
      console.log("Cleanup completed successfully");
      process.exit(0);
    } catch (error) {
      console.error("Error during cleanup:", error);
      process.exit(1);
    }
  };

  public initialize(): void {
    process.on("SIGTERM", () => this.handleShutdown("SIGTERM"));
    process.on("SIGINT", () => this.handleShutdown("SIGINT"));

    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      this.handleShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      this.handleShutdown("unhandledRejection");
    });

    console.log("Cleanup service initialized");
  }
}

export const cleanupService = new CleanupService();
export default cleanupService;
