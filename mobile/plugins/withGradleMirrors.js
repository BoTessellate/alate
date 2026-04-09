/**
 * Expo Config Plugin — withGradleMirrors
 *
 * Two-layer Maven mirror fix for EAS free-tier Maven Central 429 errors:
 *
 * Layer 1: Write a Gradle init script to ~/.gradle/init.d/ (global, picked up
 *           before any task including buildscript classpath resolution)
 *
 * Layer 2: Directly patch android/build.gradle to inject our mirrors into the
 *           buildscript { repositories {} } block (belt-and-suspenders fallback)
 */

const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const os = require('os');
const fs = require('fs');

const MIRROR_REPOS = [
  "      maven { url 'https://repo1.maven.org/maven2/' }",
  "      maven { url 'https://s01.oss.sonatype.org/content/repositories/releases/' }",
].join('\n');

const INIT_SCRIPT = [
  'allprojects {',
  '  buildscript {',
  '    repositories {',
  "      maven { url 'https://repo1.maven.org/maven2/' }",
  "      maven { url 'https://s01.oss.sonatype.org/content/repositories/releases/' }",
  '    }',
  '  }',
  '  repositories {',
  "    maven { url 'https://repo1.maven.org/maven2/' }",
  "    maven { url 'https://s01.oss.sonatype.org/content/repositories/releases/' }",
  '  }',
  '}',
  '',
].join('\n');

module.exports = function withGradleMirrors(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      // --- Layer 1: global Gradle init script ---
      try {
        const initDir = path.join(os.homedir(), '.gradle', 'init.d');
        fs.mkdirSync(initDir, { recursive: true });
        fs.writeFileSync(path.join(initDir, 'mirrors.gradle'), INIT_SCRIPT);
        console.log('[withGradleMirrors] Init script written to', initDir);
      } catch (e) {
        console.warn('[withGradleMirrors] Init script write failed:', e.message);
      }

      // --- Layer 2: patch android/build.gradle buildscript block ---
      try {
        const buildGradlePath = path.join(
          config.modResults.androidManifest
            ? config.modRequest.platformProjectRoot
            : path.join(config.modRequest.projectRoot, 'android'),
          'build.gradle'
        );

        if (fs.existsSync(buildGradlePath)) {
          let content = fs.readFileSync(buildGradlePath, 'utf8');

          // Inject mirrors after mavenCentral() inside buildscript { repositories { ... } }
          if (!content.includes('repo1.maven.org')) {
            content = content.replace(
              /(buildscript\s*\{[\s\S]*?repositories\s*\{[\s\S]*?)(mavenCentral\(\))/,
              `$1$2\n${MIRROR_REPOS}`
            );
            fs.writeFileSync(buildGradlePath, content);
            console.log('[withGradleMirrors] Patched android/build.gradle buildscript repos');
          }
        }
      } catch (e) {
        console.warn('[withGradleMirrors] build.gradle patch failed:', e.message);
      }

      return config;
    },
  ]);
};
