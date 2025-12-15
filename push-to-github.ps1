# push-to-github.ps1
# Handmatig script om je wijzigingen te committen en pushen naar GitHub

cd "C:\TenderZen"
git add .
$commitMsg = Read-Host "Commit message"
git commit -m "$commitMsg"
git push origin main
