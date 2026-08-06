param(
    [string]$Profile = "beorimi-sso",
    [string]$StackName = "beorimi-backend-secure",
    [string]$Region = "ap-northeast-2"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputRoot = (Resolve-Path (Join-Path $repositoryRoot ".aws-build")).Path
$repositoryPrefix = $repositoryRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar

if (-not $outputRoot.StartsWith(
    $repositoryPrefix,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw "Smoke output must stay inside the repository: $outputRoot"
}

$functionName = "beorimi-api-secure"
$smokeOwner = "backend-smoke-test"
$payloadFile = Join-Path $outputRoot "smoke-payload.json"
$imageFile = Join-Path $outputRoot "smoke-image.jpg"
$putHeadersFile = Join-Path $outputRoot "smoke-put-headers.txt"
$putBodyFile = Join-Path $outputRoot "smoke-put-body.xml"
$ddbKeyFile = Join-Path $outputRoot "smoke-ddb-key.json"
$responseFiles = @(
    (Join-Path $outputRoot "smoke-upload.json"),
    (Join-Path $outputRoot "smoke-create.json"),
    (Join-Path $outputRoot "smoke-get.json")
)
$temporaryFiles = $responseFiles + @(
    $payloadFile,
    $imageFile,
    $putHeadersFile,
    $putBodyFile
    $ddbKeyFile
)

$stackOutputs = aws cloudformation describe-stacks `
    --profile $Profile `
    --region $Region `
    --stack-name $StackName `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    throw "Could not read stack outputs"
}

$bucketName = ($stackOutputs | Where-Object OutputKey -eq "ImageBucketName").OutputValue
$tableName = ($stackOutputs | Where-Object OutputKey -eq "AnalysisTableName").OutputValue
$imageKey = $null
$imageVersionId = $null
$analysisId = $null

function Invoke-BackendLambda {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [string]$OutputPath
    )

    $bodyText = if ($null -eq $Body) {
        $null
    } else {
        $Body | ConvertTo-Json -Compress
    }
    $event = @{
        version = "2.0"
        routeKey = "$Method $Path"
        rawPath = $Path
        rawQueryString = ""
        headers = @{ "content-type" = "application/json" }
        requestContext = @{
            accountId = "smoke"
            apiId = "smoke"
            authorizer = @{
                jwt = @{
                    claims = @{ sub = $smokeOwner }
                    scopes = @("aws.cognito.signin.user.admin")
                }
            }
            domainName = "smoke.local"
            domainPrefix = "smoke"
            http = @{
                method = $Method
                path = $Path
                protocol = "HTTP/1.1"
                sourceIp = "127.0.0.1"
                userAgent = "backend-smoke"
            }
            requestId = "smoke-request"
            routeKey = "$Method $Path"
            stage = "`$default"
            time = "05/Aug/2026:00:00:00 +0000"
            timeEpoch = 1785888000000
        }
        body = $bodyText
        isBase64Encoded = $false
    }
    $payload = $event | ConvertTo-Json -Compress -Depth 10
    [System.IO.File]::WriteAllText(
        $payloadFile,
        $payload,
        [System.Text.UTF8Encoding]::new($false)
    )
    $payloadUri = "fileb://$($payloadFile.Replace('\', '/'))"

    aws lambda invoke `
        --profile $Profile `
        --region $Region `
        --function-name $functionName `
        --cli-binary-format raw-in-base64-out `
        --payload $payloadUri `
        $OutputPath `
        --query "StatusCode" `
        --output text | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Lambda invocation failed: $Method $Path"
    }
    return Get-Content -LiteralPath $OutputPath -Raw -Encoding utf8 |
        ConvertFrom-Json
}

try {
    $uploadResponse = Invoke-BackendLambda `
        -Method "POST" `
        -Path "/api/uploads" `
        -Body @{
            filename = "smoke.jpg"
            content_type = "image/jpeg"
            size_bytes = 100
        } `
        -OutputPath $responseFiles[0]
    if ($uploadResponse.statusCode -ne 200) {
        throw "Upload URL endpoint returned $($uploadResponse.statusCode)"
    }

    $uploadBody = $uploadResponse.body | ConvertFrom-Json
    $imageKey = $uploadBody.image_key
    [System.IO.File]::WriteAllBytes($imageFile, [byte[]](1..100))
    $putStatus = curl.exe `
        --silent `
        --show-error `
        --request PUT `
        --header "Content-Type: image/jpeg" `
        --upload-file $imageFile `
        --dump-header $putHeadersFile `
        --output $putBodyFile `
        --write-out "%{http_code}" `
        $uploadBody.upload_url
    if ($LASTEXITCODE -ne 0 -or $putStatus -ne "200") {
        $errorCode = "unknown"
        if ((Test-Path -LiteralPath $putBodyFile) -and
            (Get-Item -LiteralPath $putBodyFile).Length -gt 0) {
            $s3Error = [xml](Get-Content -LiteralPath $putBodyFile -Raw)
            $errorCode = $s3Error.Error.Code
        }
        throw "S3 upload failed with HTTP $putStatus ($errorCode)"
    }
    $versionHeader = Get-Content -LiteralPath $putHeadersFile |
        Where-Object { $_ -match "^x-amz-version-id:" } |
        Select-Object -First 1
    if ($versionHeader) {
        $imageVersionId = ($versionHeader -split ":", 2)[1].Trim()
    }

    $createResponse = Invoke-BackendLambda `
        -Method "POST" `
        -Path "/api/analyses" `
        -Body @{ image_key = $imageKey } `
        -OutputPath $responseFiles[1]
    if ($createResponse.statusCode -ne 202) {
        throw "Analysis endpoint returned $($createResponse.statusCode)"
    }

    $createBody = $createResponse.body | ConvertFrom-Json
    $analysisId = $createBody.id
    $completed = $null
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        $getResponse = Invoke-BackendLambda `
            -Method "GET" `
            -Path "/api/analyses/$analysisId" `
            -Body $null `
            -OutputPath $responseFiles[2]
        if ($getResponse.statusCode -ne 200) {
            throw "Analysis lookup returned $($getResponse.statusCode)"
        }

        $current = $getResponse.body | ConvertFrom-Json
        if ($current.status -eq "completed") {
            $completed = $current
            break
        }
        if ($current.status -eq "failed") {
            throw "Worker marked the smoke analysis as failed"
        }
        Start-Sleep -Seconds 2
    }

    if ($null -eq $completed) {
        throw "Analysis did not complete in time"
    }
    Write-Output "PIPELINE_STATUS=$($completed.status)"
    Write-Output "ITEM_NAME=$($completed.item_name)"
    Write-Output "FEE=$($completed.fee)"
    Write-Output "MESSAGE=$($completed.message)"
} finally {
    if ($analysisId) {
        $key = @{ id = @{ S = $analysisId } } | ConvertTo-Json -Compress
        [System.IO.File]::WriteAllText(
            $ddbKeyFile,
            $key,
            [System.Text.UTF8Encoding]::new($false)
        )
        $ddbKeyUri = "file://$($ddbKeyFile.Replace('\', '/'))"
        aws dynamodb delete-item `
            --profile $Profile `
            --region $Region `
            --table-name $tableName `
            --key $ddbKeyUri | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not delete the smoke DynamoDB record"
        }
    }
    if ($imageKey -and $imageVersionId) {
        aws s3api delete-object `
            --profile $Profile `
            --region $Region `
            --bucket $bucketName `
            --key $imageKey `
            --version-id $imageVersionId | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not delete the smoke S3 object version"
        }
    }
    foreach ($temporaryFile in $temporaryFiles) {
        if (Test-Path -LiteralPath $temporaryFile) {
            Remove-Item -LiteralPath $temporaryFile -Force
        }
    }
}

Write-Output "SMOKE_DATA_CLEANED=true"
