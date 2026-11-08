from fastapi import APIRouter, HTTPException
from server.database import db
from server.schemas.models import EligibilityRequest

router = APIRouter(prefix="/api")

@router.post("/check-eligibility")
def check_eligibility(payload: EligibilityRequest):
    try:
        cgpa = payload.cgpa
        branch = payload.branch.upper()
        backlogs = payload.backlogs
        
        companies = list(db["companies"].find())
        results = []
        
        for c in companies:
            eligible = True
            reasons = []
            
            # Check CGPA
            if cgpa < c["cgpa"]:
                eligible = False
                reasons.append(f"CGPA is {cgpa:.2f}, required is {c['cgpa']:.2f}")
                
            # Check Branch
            allowed_branches = [b.upper() for b in c["branches"]]
            if branch not in allowed_branches:
                eligible = False
                reasons.append(f"Branch '{branch}' is not in allowed list ({', '.join(c['branches'])})")
                
            # Check Backlogs
            if backlogs > c["backlogs_allowed"]:
                eligible = False
                reasons.append(f"Active backlogs is {backlogs}, max allowed is {c['backlogs_allowed']}")
                
            results.append({
                "company_id": str(c["_id"]),
                "name": c["name"],
                "role": c["role"],
                "package": c["package"],
                "required_cgpa": c["cgpa"],
                "required_branches": c["branches"],
                "required_backlogs": c["backlogs_allowed"],
                "eligible": eligible,
                "reason": "Requirements met successfully!" if eligible else " & ".join(reasons)
            })
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
