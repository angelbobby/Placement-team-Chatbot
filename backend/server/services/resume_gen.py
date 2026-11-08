import io
import os
from pypdf import PdfReader
import docx
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# -------------------------------------------------------------
# 1. Text Extraction Service
# -------------------------------------------------------------
def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    except Exception as e:
        return f"Error extracting PDF: {str(e)}"

def extract_text_from_docx_bytes(file_bytes: bytes) -> str:
    try:
        docx_file = io.BytesIO(file_bytes)
        doc = docx.Document(docx_file)
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        # Table content as well
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text.append(cell.text)
        return '\n'.join(text)
    except Exception as e:
        return f"Error extracting Docx: {str(e)}"

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.pdf':
        return extract_text_from_pdf_bytes(file_bytes)
    elif ext == '.docx':
        return extract_text_from_docx_bytes(file_bytes)
    elif ext in ['.txt', '.md']:
        return file_bytes.decode('utf-8', errors='ignore')
    else:
        raise ValueError("Unsupported file format. Please upload PDF, Word (docx), or Text (txt) files.")

# -------------------------------------------------------------
# 2. PDF Resume Generation (ReportLab)
# -------------------------------------------------------------
def generate_pdf(resume_data: dict) -> bytes:
    buffer = io.BytesIO()
    # 0.5-inch margins for modern clean look, space optimization
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Standalone ParagraphStyles to prevent overlap/name collisions
    name_style = ParagraphStyle(
        'ResumeName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor('#111827')
    )
    
    contact_style = ParagraphStyle(
        'ResumeContact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        alignment=1, # Center
        textColor=colors.HexColor('#4b5563')
    )
    
    section_title_style = ParagraphStyle(
        'ResumeSectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=2
    )
    
    body_style = ParagraphStyle(
        'ResumeBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#374151')
    )
    
    bold_body_style = ParagraphStyle(
        'ResumeBoldBody',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    
    italic_body_style = ParagraphStyle(
        'ResumeItalicBody',
        parent=body_style,
        fontName='Helvetica-Oblique'
    )
    
    story = []
    
    # --- HEADER SECTION ---
    p_info = resume_data.get('personal_info', {})
    name = p_info.get('name', '').strip() or "Your Name"
    story.append(Paragraph(name, name_style))
    story.append(Spacer(1, 4))
    
    contact_parts = []
    email = p_info.get('email', '').strip()
    phone = p_info.get('phone', '').strip()
    linkedin = p_info.get('linkedin', '').strip()
    location = p_info.get('location', '').strip()
    website = p_info.get('website', '').strip()
    
    if email: contact_parts.append(email)
    if phone: contact_parts.append(phone)
    if location: contact_parts.append(location)
    if linkedin: contact_parts.append(f"LinkedIn: {linkedin}")
    if website: contact_parts.append(website)
    
    contact_string = " | ".join(contact_parts)
    story.append(Paragraph(contact_string, contact_style))
    story.append(Spacer(1, 12))
    
    # Helper for adding section headers with horizontal lines
    def add_section_header(title):
        t = Table([[Paragraph(title.upper(), section_title_style)]], colWidths=[540])
        t.setStyle(TableStyle([
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor('#e5e7eb')),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

    # --- SUMMARY ---
    summary = resume_data.get('summary', '').strip()
    if summary:
        add_section_header("Professional Summary")
        story.append(Paragraph(summary, body_style))
        story.append(Spacer(1, 10))
        
    # --- EDUCATION ---
    education_list = resume_data.get('education', [])
    if education_list:
        add_section_header("Education")
        for edu in education_list:
            deg = edu.get('degree', '').strip()
            field = edu.get('field_of_study', '').strip()
            school = edu.get('school', '').strip()
            year = edu.get('graduation_year', '').strip()
            gpa = edu.get('gpa', '').strip()
            
            degree_text = f"<b>{deg}</b>"
            if field:
                degree_text += f" in {field}"
                
            edu_table_data = [
                [Paragraph(degree_text, body_style), Paragraph(f"<b>{year}</b>" if year else "", ParagraphStyle('RightText', parent=body_style, alignment=2))],
                [Paragraph(school, italic_body_style), Paragraph(f"GPA: {gpa}" if gpa else "", ParagraphStyle('RightText2', parent=body_style, alignment=2))]
            ]
            t = Table(edu_table_data, colWidths=[380, 160])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(t)
            story.append(Spacer(1, 6))
        story.append(Spacer(1, 4))
        
    # --- EXPERIENCE ---
    experience_list = resume_data.get('experience', [])
    if experience_list:
        add_section_header("Work Experience")
        for exp in experience_list:
            role = exp.get('role', '').strip()
            company = exp.get('company', '').strip()
            loc = exp.get('location', '').strip()
            duration = exp.get('duration', '').strip()
            desc = exp.get('description', '').strip()
            
            header_text = f"<b>{role}</b>"
            if company:
                header_text += f" | <i>{company}</i>"
            if loc:
                header_text += f" ({loc})"
                
            exp_table_data = [
                [Paragraph(header_text, body_style), Paragraph(f"<b>{duration}</b>" if duration else "", ParagraphStyle('RightText3', parent=body_style, alignment=2))]
            ]
            t = Table(exp_table_data, colWidths=[380, 160])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(t)
            
            if desc:
                story.append(Spacer(1, 2))
                # Support basic formatting or split by bullets
                lines = desc.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    # Strip lead hyphen/asterisk for clean PDF bullet layout
                    if line.startswith(('-', '*')):
                        line = line[1:].strip()
                    story.append(Paragraph(f"&bull; {line}", ParagraphStyle('BulletLine', parent=body_style, leftIndent=12, firstLineIndent=-8)))
                    
            story.append(Spacer(1, 8))
        story.append(Spacer(1, 2))
        
    # --- PROJECTS ---
    projects_list = resume_data.get('projects', [])
    if projects_list:
        add_section_header("Projects")
        for proj in projects_list:
            title = proj.get('title', '').strip()
            tech = proj.get('technologies', [])
            desc = proj.get('description', '').strip()
            link = proj.get('link', '').strip()
            
            title_text = f"<b>{title}</b>"
            if tech:
                title_text += f" (<i>{', '.join(tech)}</i>)"
                
            proj_table_data = [
                [Paragraph(title_text, body_style), Paragraph(f"<b>{link}</b>" if link else "", ParagraphStyle('RightText4', parent=body_style, alignment=2, textColor=colors.HexColor('#2563eb')))]
            ]
            t = Table(proj_table_data, colWidths=[380, 160])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(t)
            
            if desc:
                story.append(Spacer(1, 2))
                lines = desc.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith(('-', '*')):
                        line = line[1:].strip()
                    story.append(Paragraph(f"&bull; {line}", ParagraphStyle('BulletLineProj', parent=body_style, leftIndent=12, firstLineIndent=-8)))
                    
            story.append(Spacer(1, 8))
        story.append(Spacer(1, 2))

    # --- SKILLS ---
    skills_obj = resume_data.get('skills', {})
    if isinstance(skills_obj, list):
        # Fallback for old schema
        if skills_obj:
            add_section_header("Skills")
            skills_text = ", ".join(skills_obj)
            story.append(Paragraph(skills_text, body_style))
            story.append(Spacer(1, 10))
    else:
        # Categorized skills
        has_skills = any(bool(v) for v in skills_obj.values())
        if has_skills:
            add_section_header("Skills")
            
            # Helper to map keys to proper labels
            skill_labels = {
                "programming_languages": "Languages",
                "frameworks": "Frameworks",
                "databases": "Databases",
                "tools": "Tools",
                "other": "Other"
            }
            
            for key, label in skill_labels.items():
                category_skills = skills_obj.get(key, [])
                if category_skills:
                    skill_text = f"<b>{label}:</b> {', '.join(category_skills)}"
                    story.append(Paragraph(skill_text, body_style))
            
            story.append(Spacer(1, 10))
        
    # --- CERTIFICATIONS ---
    certs_list = resume_data.get('certifications', [])
    if certs_list:
        add_section_header("Certifications")
        for cert in certs_list:
            if cert.strip():
                story.append(Paragraph(f"&bull; {cert.strip()}", ParagraphStyle('BulletLineCert', parent=body_style, leftIndent=12, firstLineIndent=-8)))
                story.append(Spacer(1, 2))
                
    # --- ACHIEVEMENTS ---
    achievements_list = resume_data.get('achievements', [])
    if achievements_list:
        add_section_header("Achievements")
        for ach in achievements_list:
            if ach.strip():
                story.append(Paragraph(f"&bull; {ach.strip()}", ParagraphStyle('BulletLineAchiev', parent=body_style, leftIndent=12, firstLineIndent=-8)))
                story.append(Spacer(1, 2))
                
    # Build Document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

# -------------------------------------------------------------
# 3. DOCX Resume Generation (python-docx)
# -------------------------------------------------------------
def generate_docx(resume_data: dict) -> bytes:
    doc = docx.Document()
    
    # 0.5-inch margins
    for section in doc.sections:
        section.top_margin = docx.shared.Inches(0.5)
        section.bottom_margin = docx.shared.Inches(0.5)
        section.left_margin = docx.shared.Inches(0.5)
        section.right_margin = docx.shared.Inches(0.5)
        
    # Title (Name)
    p_info = resume_data.get('personal_info', {})
    name = p_info.get('name', '').strip() or "Your Name"
    p_name = doc.add_paragraph()
    p_name.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    run_name = p_name.add_run(name)
    run_name.font.name = 'Arial'
    run_name.font.size = docx.shared.Pt(18)
    run_name.bold = True
    
    # Contact Details
    contact_parts = []
    email = p_info.get('email', '').strip()
    phone = p_info.get('phone', '').strip()
    linkedin = p_info.get('linkedin', '').strip()
    location = p_info.get('location', '').strip()
    website = p_info.get('website', '').strip()
    
    if email: contact_parts.append(email)
    if phone: contact_parts.append(phone)
    if location: contact_parts.append(location)
    if linkedin: contact_parts.append(f"LinkedIn: {linkedin}")
    if website: contact_parts.append(website)
    
    contact_string = " | ".join(contact_parts)
    p_contact = doc.add_paragraph()
    p_contact.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER
    run_contact = p_contact.add_run(contact_string)
    run_contact.font.name = 'Arial'
    run_contact.font.size = docx.shared.Pt(9.5)
    
    # Helper for adding formatted section headers
    def add_docx_section_header(title):
        p_hdr = doc.add_paragraph()
        run_hdr = p_hdr.add_run(title.upper())
        run_hdr.font.name = 'Arial'
        run_hdr.font.size = docx.shared.Pt(11)
        run_hdr.bold = True
        
        # Add bottom border in docx via XML properties
        pPr = p_hdr._p.get_or_add_pPr()
        pBdr = docx.oxml.OxmlElement('w:pBdr')
        bottom = docx.oxml.OxmlElement('w:bottom')
        bottom.set(docx.oxml.ns.qn('w:val'), 'single')
        bottom.set(docx.oxml.ns.qn('w:sz'), '6')
        bottom.set(docx.oxml.ns.qn('w:space'), '1')
        bottom.set(docx.oxml.ns.qn('w:color'), 'e5e7eb')
        pBdr.append(bottom)
        pPr.append(pBdr)

    # --- SUMMARY ---
    summary = resume_data.get('summary', '').strip()
    if summary:
        add_docx_section_header("Professional Summary")
        p_sum = doc.add_paragraph()
        run_sum = p_sum.add_run(summary)
        run_sum.font.name = 'Arial'
        run_sum.font.size = docx.shared.Pt(9.5)
        
    # --- EDUCATION ---
    education_list = resume_data.get('education', [])
    if education_list:
        add_docx_section_header("Education")
        for edu in education_list:
            deg = edu.get('degree', '').strip()
            field = edu.get('field_of_study', '').strip()
            school = edu.get('school', '').strip()
            year = edu.get('graduation_year', '').strip()
            gpa = edu.get('gpa', '').strip()
            
            p_edu = doc.add_paragraph()
            run_deg = p_edu.add_run(f"{deg}")
            run_deg.bold = True
            if field:
                p_edu.add_run(f" in {field}")
            p_edu.add_run(f"\n{school}")
            if gpa:
                p_edu.add_run(f" (GPA: {gpa})")
                
            # Right align the year
            # In python-docx, to make a clean layout, we can use a table or tabs.
            # Using tab stops is the standard way. Let's add a right tab stop at 7.5 inches.
            tab_stops = p_edu.paragraph_format.tab_stops
            tab_stops.add_tab_stop(docx.shared.Inches(7.5), docx.enum.text.WD_TAB_ALIGNMENT.RIGHT)
            
            p_edu.text = "" # Reset and format with tab
            r1 = p_edu.add_run(f"{deg}" + (f" in {field}" if field else "") + f"\n{school}" + (f" (GPA: {gpa})" if gpa else ""))
            r1.font.name = 'Arial'
            r1.font.size = docx.shared.Pt(9.5)
            p_edu.add_run("\t")
            r2 = p_edu.add_run(f"{year}")
            r2.bold = True
            r2.font.name = 'Arial'
            r2.font.size = docx.shared.Pt(9.5)

    # --- EXPERIENCE ---
    experience_list = resume_data.get('experience', [])
    if experience_list:
        add_docx_section_header("Work Experience")
        for exp in experience_list:
            role = exp.get('role', '').strip()
            company = exp.get('company', '').strip()
            loc = exp.get('location', '').strip()
            duration = exp.get('duration', '').strip()
            desc = exp.get('description', '').strip()
            
            p_exp = doc.add_paragraph()
            tab_stops = p_exp.paragraph_format.tab_stops
            tab_stops.add_tab_stop(docx.shared.Inches(7.5), docx.enum.text.WD_TAB_ALIGNMENT.RIGHT)
            
            comp_loc = company + (f" ({loc})" if loc else "")
            r1 = p_exp.add_run(f"{role} | {comp_loc}")
            r1.bold = True
            r1.font.name = 'Arial'
            r1.font.size = docx.shared.Pt(9.5)
            
            p_exp.add_run("\t")
            r2 = p_exp.add_run(f"{duration}")
            r2.bold = True
            r2.font.name = 'Arial'
            r2.font.size = docx.shared.Pt(9.5)
            
            if desc:
                lines = desc.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith(('-', '*')):
                        line = line[1:].strip()
                    p_bullet = doc.add_paragraph(style='List Bullet')
                    r_bullet = p_bullet.add_run(line)
                    r_bullet.font.name = 'Arial'
                    r_bullet.font.size = docx.shared.Pt(9.5)
                    
    # --- PROJECTS ---
    projects_list = resume_data.get('projects', [])
    if projects_list:
        add_docx_section_header("Projects")
        for proj in projects_list:
            title = proj.get('title', '').strip()
            tech = proj.get('technologies', [])
            desc = proj.get('description', '').strip()
            link = proj.get('link', '').strip()
            
            p_proj = doc.add_paragraph()
            tab_stops = p_proj.paragraph_format.tab_stops
            tab_stops.add_tab_stop(docx.shared.Inches(7.5), docx.enum.text.WD_TAB_ALIGNMENT.RIGHT)
            
            tech_str = f" ({', '.join(tech)})" if tech else ""
            r1 = p_proj.add_run(f"{title}{tech_str}")
            r1.bold = True
            r1.font.name = 'Arial'
            r1.font.size = docx.shared.Pt(9.5)
            
            p_proj.add_run("\t")
            r2 = p_proj.add_run(f"{link}")
            r2.font.name = 'Arial'
            r2.font.size = docx.shared.Pt(9.5)
            
            if desc:
                lines = desc.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith(('-', '*')):
                        line = line[1:].strip()
                    p_bullet = doc.add_paragraph(style='List Bullet')
                    r_bullet = p_bullet.add_run(line)
                    r_bullet.font.name = 'Arial'
                    r_bullet.font.size = docx.shared.Pt(9.5)

    # --- SKILLS ---
    skills_obj = resume_data.get('skills', {})
    if isinstance(skills_obj, list):
        if skills_obj:
            add_docx_section_header("Skills")
            p_sk = doc.add_paragraph()
            r_sk = p_sk.add_run(", ".join(skills_obj))
            r_sk.font.name = 'Arial'
            r_sk.font.size = docx.shared.Pt(9.5)
    else:
        has_skills = any(bool(v) for v in skills_obj.values())
        if has_skills:
            add_docx_section_header("Skills")
            skill_labels = {
                "programming_languages": "Languages",
                "frameworks": "Frameworks",
                "databases": "Databases",
                "tools": "Tools",
                "other": "Other"
            }
            for key, label in skill_labels.items():
                category_skills = skills_obj.get(key, [])
                if category_skills:
                    p_sk = doc.add_paragraph()
                    r_lbl = p_sk.add_run(f"{label}: ")
                    r_lbl.bold = True
                    r_lbl.font.name = 'Arial'
                    r_lbl.font.size = docx.shared.Pt(9.5)
                    r_sk = p_sk.add_run(", ".join(category_skills))
                    r_sk.font.name = 'Arial'
                    r_sk.font.size = docx.shared.Pt(9.5)
        
    # --- CERTIFICATIONS ---
    certs_list = resume_data.get('certifications', [])
    if certs_list:
        add_docx_section_header("Certifications")
        for cert in certs_list:
            if cert.strip():
                p_c = doc.add_paragraph(style='List Bullet')
                r_c = p_c.add_run(cert.strip())
                r_c.font.name = 'Arial'
                r_c.font.size = docx.shared.Pt(9.5)
                
    # --- ACHIEVEMENTS ---
    achievements_list = resume_data.get('achievements', [])
    if achievements_list:
        add_docx_section_header("Achievements")
        for ach in achievements_list:
            if ach.strip():
                p_a = doc.add_paragraph(style='List Bullet')
                r_a = p_a.add_run(ach.strip())
                r_a.font.name = 'Arial'
                r_a.font.size = docx.shared.Pt(9.5)
                
    # Save to BytesIO
    docx_io = io.BytesIO()
    doc.save(docx_io)
    docx_bytes = docx_io.getvalue()
    docx_io.close()
    return docx_bytes
