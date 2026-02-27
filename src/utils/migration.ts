import { App, TFile, Notice } from 'obsidian';

/**
 * Simplified, safe migration utility to convert legacy 'bases-cms' view types to 'cms'
 * Scans .md, .base, and .mdx files.
 */
export async function migrateBasesCmsToCms(app: App): Promise<number> {
    const files = app.vault.getFiles();
    let migratedCount = 0;

    console.log(`Bases CMS: Starting safe vault scan for 'bases-cms' types...`);

    for (const file of files) {
        const ext = file.extension.toLowerCase();
        if (ext === 'md' || ext === 'base' || ext === 'mdx') {
            try {
                const content = await app.vault.read(file);

                // Extremely specific and safe replacement.
                // We only target the value 'bases-cms' when preceded by 'type:'
                // Using [ \t]* ensures we NEVER swallow newlines (\n).
                if (content.toLowerCase().includes('bases-cms')) {
                    // This regex targets: name: bases-cms, name: "bases-cms", etc.
                    // The use of [ \t]* is critical to avoid the corruption seen earlier.
                    const newContent = content.replace(/(type[ \t]*:[ \t]*["']?)bases-cms\b/gi, '$1cms');

                    if (newContent !== content) {
                        await app.vault.modify(file, newContent);
                        migratedCount++;
                        console.log(`Bases CMS: Migrated ${file.path}`);
                    }
                }
            } catch (error) {
                console.error(`Bases CMS: Error reading ${file.path}:`, error);
            }
        }
    }

    console.log(`Bases CMS Migration: Updated ${migratedCount} files.`);
    return migratedCount;
}
