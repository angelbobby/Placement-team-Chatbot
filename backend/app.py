import os
import uvicorn
from server.main import app

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Launching FastAPI Server on port {port}...")
    # Run uvicorn server. Reloading is enabled for developer ease.
    uvicorn.run("server.main:app", host="0.0.0.0", port=port, reload=True)

