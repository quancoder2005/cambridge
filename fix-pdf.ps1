#!/usr/bin/env powershell
# Fix remaining PDF references in js/script.js and js.txt

$scriptFile = "f:\WEB_ENG png\js\script.js"
$jsTextFile = "f:\WEB_ENG png\js.txt"

# Read files
$scriptContent = Get-Content $scriptFile -Raw
$jsTextContent = Get-Content $jsTextFile -Raw

# Fix js/script.js
# 1. Fix comment
$scriptContent = $scriptContent -replace "// 2\.1\. Đổi test: cập nhật PDF \+ render lại số câu", "// 2.1. Đổi test: render lại số câu"

# 2. Remove renderCombinedPdfViewer() call
$scriptContent = $scriptContent -replace "`n\s+renderCombinedPdfViewer\(\);", "`n"

# 3. Remove pdf-error class from error message
$scriptContent = $scriptContent -replace 'area\.innerHTML = `<p class="pdf-error">Không tải được data/answers\.json</p>`', 'area.innerHTML = `<p>Không tải được data/answers.json</p>`'

# 4. Fix PDFs comment
$scriptContent = $scriptContent -replace "// Allow page to initialize even when not logged in so PDFs and questions render\.", "// Allow page to initialize even when not logged in so questions render."

# Write back
Set-Content $scriptFile $scriptContent

# Same fixes for js.txt
$jsTextContent = $jsTextContent -replace "// 2\.1\. Đổi test: cập nhật PDF \+ render lại số câu", "// 2.1. Đổi test: render lại số câu"
$jsTextContent = $jsTextContent -replace "`n\s+renderCombinedPdfViewer\(\);", "`n"
$jsTextContent = $jsTextContent -replace 'area\.innerHTML = `<p class="pdf-error">Không tải được data/answers\.json</p>`', 'area.innerHTML = `<p>Không tải được data/answers.json</p>`'
$jsTextContent = $jsTextContent -replace "// Allow page to initialize even when not logged in so PDFs and questions render\.", "// Allow page to initialize even when not logged in so questions render."

Set-Content $jsTextFile $jsTextContent

Write-Host "Done! PDF references removed from js/script.js and js.txt"
