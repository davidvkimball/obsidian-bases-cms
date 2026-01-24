#!/bin/bash

# Setup skills symlinks for Obsidian Sample Plugin Plus
# This script creates symlinks to the obsidian-dev-skills repository

set -e

SKILLS_REPO_PATH="${1:-"../obsidian-dev-skills"}"

echo "Setting up skills symlinks..."

# Check if skills repo exists
if [ ! -d "$SKILLS_REPO_PATH" ]; then
    echo "Skills repository not found at: $SKILLS_REPO_PATH"
    echo "Please clone obsidian-dev-skills to a sibling directory."
    echo "Example: git clone https://github.com/davidvkimball/obsidian-dev-skills.git ../obsidian-dev-skills"
    exit 1
fi

SKILLS_DIR=".agent/skills"

# Create skills directory if it doesn't exist
mkdir -p "$SKILLS_DIR"

SKILLS=("obsidian-dev" "obsidian-ops" "obsidian-ref")

for skill in "${SKILLS[@]}"; do
    target_path="$SKILLS_DIR/$skill"
    source_path="$SKILLS_REPO_PATH/$skill"

    # Remove existing symlink/directory if it exists
    if [ -L "$target_path" ] || [ -d "$target_path" ]; then
        rm -rf "$target_path"
    fi

    # Create symlink
    echo "Creating symlink: $skill"
    ln -s "$source_path" "$target_path"
done

echo "Skills setup complete!"
echo "The following skills are now available:"
echo "  - obsidian-dev (core development)"
echo "  - obsidian-ops (operations & workflows)"
echo "  - obsidian-ref (technical references)"