# push-to-github.ps1
# Handmatig script om je wijzigingen te committen en pushen naar GitHub

cd "C:\TenderZen"
git add .
${commitMsg} = "Auto-commit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m "$commitMsg"
git push origin main
