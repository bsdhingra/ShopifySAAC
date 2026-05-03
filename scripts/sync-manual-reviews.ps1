param(
  [string]$FeedUrl = "https://docs.google.com/spreadsheets/d/1g67C9dVglF8od6OJM7cgREJxyzCmPai1-AMJT9YBAqM/export?format=csv&gid=0"
)

$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$outputPath = Join-Path $root "assets\\manual-reviews-data.json"
$rawImportPath = Join-Path $root "facebook-reviews-raw.json"

function Repair-Mojibake {
  param([string]$Value)

  if ([string]::IsNullOrEmpty($Value)) { return $Value }
  if ($Value -notmatch '[\u00C2\u00C3\u00E2\u00F0]') { return $Value }

  function Get-SuspiciousScore {
    param([string]$Text)
    $matches = [regex]::Matches($Text, '[\u00C2\u00C3\u00E2\u00F0]')
    return $matches.Count
  }

  $current = $Value
  for ($pass = 0; $pass -lt 3; $pass++) {
    try {
      $bytes = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($current)
      $decoded = [System.Text.Encoding]::UTF8.GetString($bytes)
      if ((Get-SuspiciousScore $decoded) -lt (Get-SuspiciousScore $current)) {
        $current = $decoded
        continue
      }
    } catch {
    }
    break
  }

  return $current
}

function Normalize-Date {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }

  $trimmed = $Value.Trim()

  if ($trimmed -match '^\d{4}-\d{2}-\d{2}$') {
    return $trimmed
  }

  if ($trimmed -match '^\d{4}-\d{2}-\d{2}\s') {
    return $trimmed.Substring(0, 10)
  }

  return $trimmed
}

function Get-Truthy {
  param([string]$Value)
  return ($Value -eq "TRUE" -or $Value -eq "true")
}

$rawReviewMap = @{}
if (Test-Path $rawImportPath) {
  $rawPayload = Get-Content $rawImportPath -Raw | ConvertFrom-Json
  if ($rawPayload.data -and $rawPayload.data.reviews -and $rawPayload.data.reviews.data) {
    foreach ($rawReview in $rawPayload.data.reviews.data) {
      $rawReviewMap[$rawReview.id] = [pscustomobject]@{
        id = $rawReview.id
        source = "facebook"
        reviewerName = $rawReview.name
        reviewerAvatarUrl = $rawReview.content.avatar_url
        reviewText = $rawReview.content.review_text
        rating = [double]$rawReview.rating
        reviewDate = (Normalize-Date $rawReview.review_created_at_date)
        reviewUrl = $rawReview.content.review_url
        sourcePlatform = "facebook-page-review"
      }
    }
  }
}

$csvContent = Invoke-WebRequest -Uri $FeedUrl -UseBasicParsing | Select-Object -ExpandProperty Content
$rows = $csvContent | ConvertFrom-Csv

$reviews = @()

foreach ($row in $rows) {
  $isVisible = (Get-Truthy $row.is_visible)
  if (-not $isVisible) { continue }

  $rating = 0
  if ($row.rating -match '^\d+(\.\d+)?$') {
    $rating = [double]$row.rating
  }

  $sortOrder = 999999
  if ($row.sort_order -match '^\d+$') {
    $sortOrder = [int]$row.sort_order
  }

  $canonical = $null
  if (-not [string]::IsNullOrWhiteSpace($row.id) -and $rawReviewMap.ContainsKey($row.id)) {
    $canonical = $rawReviewMap[$row.id]
  }

  $reviewText = if ($canonical) { $canonical.reviewText } else { (Repair-Mojibake $row.review_text) }
  if ([string]::IsNullOrWhiteSpace($reviewText)) { continue }

  $reviewerName = if ($canonical) { $canonical.reviewerName } else { (Repair-Mojibake $row.reviewer_name) }
  $reviewerAvatarUrl = if ($canonical) { $canonical.reviewerAvatarUrl } else { $row.reviewer_avatar_url }
  $reviewDate = if ($canonical) { $canonical.reviewDate } else { (Normalize-Date $row.review_date) }
  $reviewUrl = if ($canonical) { $canonical.reviewUrl } else { $row.review_url }
  $source = if ($canonical) { $canonical.source } elseif ([string]::IsNullOrWhiteSpace($row.source)) { "facebook" } else { $row.source }
  $sourcePlatform = if ($canonical) { $canonical.sourcePlatform } elseif ([string]::IsNullOrWhiteSpace($row.source_platform)) { "facebook-page-review" } else { $row.source_platform }
  if ($canonical) {
    $rating = $canonical.rating
  }

  $reviews += [pscustomobject]@{
    sortOrder = $sortOrder
    id = $row.id
    source = $source
    reviewerName = $reviewerName
    reviewerAvatarUrl = $reviewerAvatarUrl
    reviewText = $reviewText
    rating = $rating
    reviewDate = $reviewDate
    reviewUrl = $reviewUrl
    isFeatured = (Get-Truthy $row.is_featured)
    sourcePlatform = $sourcePlatform
  }
}

$sortedReviews = $reviews |
  Sort-Object sortOrder |
  ForEach-Object {
    [ordered]@{
      id = $_.id
      source = $_.source
      reviewerName = $_.reviewerName
      reviewerAvatarUrl = $_.reviewerAvatarUrl
      reviewText = $_.reviewText
      rating = $_.rating
      reviewDate = $_.reviewDate
      reviewUrl = $_.reviewUrl
      isFeatured = $_.isFeatured
      sourcePlatform = $_.sourcePlatform
    }
  }

$payload = [ordered]@{
  ok = $true
  updatedAt = (Get-Date).ToUniversalTime().ToString("o")
  total = @($sortedReviews).Count
  reviews = @($sortedReviews)
}

$json = $payload | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

Write-Output "Synced $(@($sortedReviews).Count) reviews to $outputPath"
