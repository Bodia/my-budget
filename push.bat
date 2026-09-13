@echo off
echo Committing and pushing changes to git...
git add .
git commit -m "feat: add Mono Budget adapter, tighten Toshl detection, and fix modal scrolling"
git push
echo.
echo Changes pushed successfully!
pause
