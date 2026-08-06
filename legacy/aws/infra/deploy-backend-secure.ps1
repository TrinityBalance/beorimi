param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactBucket,

    [Parameter(Mandatory = $true)]
    [string]$FrontendOrigin,

    [Parameter(Mandatory = $true)]
    [string]$VlmBaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$VlmServiceTokenSecretArn,

    [string]$Profile = "beorimi-sso",
    [string]$StackName = "beorimi-backend-secure",
    [string]$Region = "ap-northeast-2"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$archivePath = & (Join-Path $PSScriptRoot "build-backend-lambda.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "Backend package build failed"
}

$archivePath = (Resolve-Path $archivePath).Path
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$artifactKey = "backend/secure/$hash.zip"

aws s3 cp $archivePath "s3://$ArtifactBucket/$artifactKey" `
    --profile $Profile `
    --region $Region `
    --only-show-errors
if ($LASTEXITCODE -ne 0) {
    throw "Backend artifact upload failed"
}

aws cloudformation deploy `
    --template-file (Join-Path $PSScriptRoot "backend-secure.yaml") `
    --stack-name $StackName `
    --profile $Profile `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --no-fail-on-empty-changeset `
    --parameter-overrides `
        "ArtifactBucket=$ArtifactBucket" `
        "BackendArtifactKey=$artifactKey" `
        "FrontendOrigin=$FrontendOrigin" `
        "VlmBaseUrl=$VlmBaseUrl" `
        "VlmServiceTokenSecretArn=$VlmServiceTokenSecretArn"

if ($LASTEXITCODE -ne 0) {
    throw "Secure Backend stack deployment failed"
}

aws cloudformation describe-stacks `
    --stack-name $StackName `
    --profile $Profile `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output table
