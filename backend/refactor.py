import re
import os

app_jsx_path = "frontend/src/App.jsx"

with open(app_jsx_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import api
if "import { api } from './api';" not in content:
    content = content.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { api } from './api';")


with open(app_jsx_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated App.jsx imports")
