#!/bin/bash
# Configure Tailscale Funnel to expose Minwei API publicly
# Run once on Mac Mini

# Route /minwei-api/* → localhost:3463
tailscale serve --bg https+insecure://localhost:3463

echo "Minwei API is now public at:"
echo "  https://damoyas-mac-mini.tailb141dd.ts.net/"
echo ""
echo "Test: curl https://damoyas-mac-mini.tailb141dd.ts.net/health"
