#!/bin/bash
# Setup script to create symlinks to the 6 core Obsidian projects
# Run this from anywhere: ./scripts/setup-ref-links.sh

# Change to project root (parent of scripts folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Setting up symlinks to core Obsidian projects..."

# Central .ref location (one level up from project)
CENTRAL_REF_ROOT="../.ref"
CENTRAL_REF="../.ref/obsidian-dev"

# Create central .ref root if it doesn't exist
if [ ! -d "$CENTRAL_REF_ROOT" ]; then
    mkdir -p "$CENTRAL_REF_ROOT"
    echo "Created central .ref directory"
fi

# Create obsidian-dev subfolder if it doesn't exist
if [ ! -d "$CENTRAL_REF" ]; then
    mkdir -p "$CENTRAL_REF"
    echo "Created obsidian-dev subfolder"
fi

# Ensure plugins and themes folders exist
mkdir -p "$CENTRAL_REF/plugins"
mkdir -p "$CENTRAL_REF/themes"

# Clone the 6 core repos if they don't exist, or pull latest if they do
if [ ! -d "$CENTRAL_REF/obsidian-api" ]; then
    echo "Cloning obsidian-api..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/obsidian-api.git obsidian-api)
else
    echo "Updating obsidian-api..."
    (cd "$CENTRAL_REF/obsidian-api" && git pull)
fi

if [ ! -d "$CENTRAL_REF/obsidian-sample-plugin" ]; then
    echo "Cloning obsidian-sample-plugin..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/obsidian-sample-plugin.git obsidian-sample-plugin)
else
    echo "Updating obsidian-sample-plugin..."
    (cd "$CENTRAL_REF/obsidian-sample-plugin" && git pull)
fi

if [ ! -d "$CENTRAL_REF/obsidian-developer-docs" ]; then
    echo "Cloning obsidian-developer-docs..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/obsidian-developer-docs.git obsidian-developer-docs)
else
    echo "Updating obsidian-developer-docs..."
    (cd "$CENTRAL_REF/obsidian-developer-docs" && git pull)
fi

if [ ! -d "$CENTRAL_REF/obsidian-plugin-docs" ]; then
    echo "Cloning obsidian-plugin-docs..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/obsidian-plugin-docs.git obsidian-plugin-docs)
else
    echo "Updating obsidian-plugin-docs..."
    (cd "$CENTRAL_REF/obsidian-plugin-docs" && git pull)
fi

if [ ! -d "$CENTRAL_REF/obsidian-sample-theme" ]; then
    echo "Cloning obsidian-sample-theme..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/obsidian-sample-theme.git obsidian-sample-theme)
else
    echo "Updating obsidian-sample-theme..."
    (cd "$CENTRAL_REF/obsidian-sample-theme" && git pull)
fi

if [ ! -d "$CENTRAL_REF/eslint-plugin" ]; then
    echo "Cloning eslint-plugin..."
    (cd "$CENTRAL_REF" && git clone https://github.com/obsidianmd/eslint-plugin.git eslint-plugin)
else
    echo "Updating eslint-plugin..."
    (cd "$CENTRAL_REF/eslint-plugin" && git pull)
fi

# Ensure project .ref directory exists
mkdir -p .ref

# Define the 6 core projects
CORE_PROJECTS=(
    "obsidian-api"
    "obsidian-sample-plugin"
    "obsidian-developer-docs"
    "obsidian-plugin-docs"
    "obsidian-sample-theme"
    "eslint-plugin"
)

# Create symlinks for each core project
for project in "${CORE_PROJECTS[@]}"; do
    link_path=".ref/$project"
    target_path="$CENTRAL_REF/$project"
    
    # Check if target exists
    if [ ! -d "$target_path" ]; then
        echo "WARNING: Target not found: $target_path"
        echo "  Skipping $project"
        continue
    fi
    
    # Remove existing link if it exists
    if [ -L "$link_path" ] || [ -d "$link_path" ]; then
        rm -rf "$link_path"
    fi
    
    # Create symlink
    ln -s "$target_path" "$link_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: $link_path -> $target_path"
    else
        echo "ERROR: Failed to create symlink for $project"
    fi
done

echo ""
echo "Setup complete!"
echo ""
echo "Verifying symlinks..."

# Verify symlinks
for project in "${CORE_PROJECTS[@]}"; do
    link_path=".ref/$project"
    if [ -L "$link_path" ]; then
        echo "✓ $project : Symlink"
    elif [ -d "$link_path" ]; then
        echo "✗ $project : Regular directory (not a symlink)"
    else
        echo "✗ $project : Missing"
    fi
done

