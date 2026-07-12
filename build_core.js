const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tempDir = path.join(__dirname, 'temp_core_build');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 1. Write ClientBrandRetriever.java
const brandDir = path.join(tempDir, 'net', 'minecraft', 'client');
fs.mkdirSync(brandDir, { recursive: true });
fs.writeFileSync(
  path.join(brandDir, 'ClientBrandRetriever.java'),
  `package net.minecraft.client;

public class ClientBrandRetriever {
    static {
        try {
            Thread thread = new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // Wait a bit for game window to initialize
                        Thread.sleep(8000);
                        String title = System.getProperty("nexoclient.title");
                        if (title == null || title.isEmpty()) {
                            title = "NEXOCLIENT";
                        }
                        while (true) {
                            Thread.sleep(1000);
                            try {
                                Class<?> glfwClass = Class.forName("org.lwjgl.glfw.GLFW");
                                java.lang.reflect.Method getCurrentContext = glfwClass.getMethod("glfwGetCurrentContext");
                                java.lang.reflect.Method setWindowTitle = glfwClass.getMethod("glfwSetWindowTitle", long.class, CharSequence.class);
                                
                                Long window = (Long) getCurrentContext.invoke(null);
                                if (window != null && window != 0) {
                                    setWindowTitle.invoke(null, window, title);
                                }
                            } catch (Throwable t) {
                            }
                        }
                    } catch (InterruptedException e) {
                    }
                }
            });
            thread.setDaemon(true);
            thread.start();
        } catch (Throwable t) {
        }
    }

    public static String getClientModName() {
        return "NEXOCLIENT";
    }

    public static String getClientBrand() {
        return "NEXOCLIENT";
    }
}`
);

// 2. Compile ClientBrandRetriever
console.log("Compiling mock ClientBrandRetriever...");
execSync(`javac -target 8 -source 8 net/minecraft/client/ClientBrandRetriever.java`, { cwd: tempDir });

// 3. Package JAR
console.log("Packaging Core JAR...");
execSync(`jar cf nexoclient-core.jar net/minecraft/client/ClientBrandRetriever.class`, { cwd: tempDir });

// 4. Copy JAR to project root
const jarPath = path.join(tempDir, 'nexoclient-core.jar');
const destPath = path.join(__dirname, 'nexoclient-core.jar');
fs.copyFileSync(jarPath, destPath);
console.log(`Copied core JAR to ${destPath}`);

// Clean up temp files
console.log("Cleaning up temp files...");
fs.rmSync(tempDir, { recursive: true, force: true });
console.log("Done!");
