#!/usr/bin/env bash

S3_BUCKET="node-archive-2025"  # Set your S3 bucket name here

# Function to upload file to S3
upload_to_s3() {
  local local_file="$1"
  local s3_key="$2"
  aws s3 cp "$local_file" "s3://$S3_BUCKET/$s3_key"
}

# Function to download file and upload to S3
# Usage: download_file <base_url> <s3_prefix> <filename>
download_file() {
  local base_url="$1"
  local s3_prefix="$2"
  local filename="$3"
  local url="$base_url/$filename"
  local s3_key="$s3_prefix/$filename"
  local tmpfile
  tmpfile=$(mktemp)

  echo "Downloading $filename to $tmpfile..."
  if ! curl -fSL "$url" -o "$tmpfile"; then
    echo "Failed to download $filename."
    rm -f "$tmpfile"
    return 1
  fi

  echo "Uploading $filename to S3 at $s3_key..."
  if upload_to_s3 "$tmpfile" "$s3_key"; then
    echo "$filename uploaded to S3 successfully."
  else
    echo "Failed to upload $filename to S3."
    rm -f "$tmpfile"
    return 1
  fi
  rm -f "$tmpfile"
}

# Function to process the archive list and download/upload files if missing
# Usage: process_archives <base_url> <s3_prefix> <list_file>
process_archives() {
  local base_url="$1"
  local s3_prefix="$2"
  local list_file="$3"
  mapfile -t lines < "$list_file"
  for (( idx=${#lines[@]}-1 ; idx>=0 ; idx-- )); do
    line="${lines[idx]}"
    hash=$(echo "$line" | awk '{print $1}')
    filename=$(echo "$line" | awk '{print $2}')
    [ -z "$hash" ] && continue
    [ -z "$filename" ] && continue
    if aws s3 ls "s3://$S3_BUCKET/$s3_prefix/$filename" > /dev/null 2>&1; then
      echo "$filename already exists in S3 at $s3_prefix. Stopping process_archives."
      break
    fi
    if ! download_file "$base_url" "$s3_prefix" "$filename"; then
      echo "Aborting process_archives due to error."
      return 1
    fi
  done
}

# Usage: process_network <base_url> <s3_prefix>
process_network() {
  local base_url="$1"
  local s3_prefix="$2"
  local tmpfile
  tmpfile=$(mktemp)

  curl -fsSL "$base_url/hash.txt" -o "$tmpfile" && sed -i -e '$d' "$tmpfile"
  if ! upload_to_s3 "$tmpfile" "$s3_prefix/hash.txt"; then
    echo "Failed to upload hash.txt to S3 at $s3_prefix."
    rm -f "$tmpfile"
    return 1
  fi
  process_archives "$base_url" "$s3_prefix" "$tmpfile"
  rm -f "$tmpfile"
}

main() {
  process_network "http://37.27.88.199:7777" "mainnet"
  process_network "http://37.27.92.171:7777" "integrationnet"
  process_network "http://46.62.246.239:7777" "testnet"
}

main "$@"
