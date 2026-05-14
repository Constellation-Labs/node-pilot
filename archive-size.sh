#!/usr/bin/env bash

# Function to get remote file size
get_remote_file_size() {
  local url="$1"
  curl -sI "$url" | awk '/Content-Length/ {print $2}' | tr -d '\r'
}

# Function to calculate the total size of all files in the archive list and print the total in bytes and GB
calculate_archive_size() {
  local base_url="$1"
  local total_size=0
  local tmpfile
  tmpfile=$(mktemp)

  curl -fsSL "$base_url/hash.txt" -o "$tmpfile" && sed -i -e '$d' "$tmpfile"

  while read -r hash filename; do
    [ -z "$hash" ] && continue
    [ -z "$filename" ] && continue
    size=$(get_remote_file_size "$base_url/$filename")
    if [[ "$size" =~ ^[0-9]+$ ]]; then
      echo "Size of $filename: $size bytes"
      total_size=$((total_size + size))
    fi
  done < "$tmpfile"
  echo "Total size: $total_size bytes"
  # Convert to GB (1 GB = 1073741824 bytes)
  gb=$(awk "BEGIN {printf \"%.2f\", $total_size/1073741824}")
  echo "Total size: $gb GB"
}

main() {
  calculate_archive_size "http://46.62.246.239:7777"
}

main "$@"
