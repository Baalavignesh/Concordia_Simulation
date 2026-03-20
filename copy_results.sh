#!/bin/bash
# Copy simulation results to dashboard public/data directory.
# Usage: ./copy_results.sh

SRC="results"
DEST="dashboard/public/data"

if [ ! -d "$SRC" ]; then
  echo "Error: $SRC directory not found. Run simulations first."
  exit 1
fi

mkdir -p "$DEST"

count=0
for config_dir in "$SRC"/*/; do
  config=$(basename "$config_dir")

  # Base results
  if [ -f "$config_dir/simulation_results.json" ]; then
    cp "$config_dir/simulation_results.json" "$DEST/${config}.json"
    ((count++))
  fi

  # CoT results
  if [ -f "$config_dir/simulation_results_cot.json" ]; then
    cp "$config_dir/simulation_results_cot.json" "$DEST/${config}_cot.json"
    ((count++))
  fi
done

echo "Copied $count files to $DEST/"
