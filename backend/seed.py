"""Full demo seed — Cameroon French end-to-end story + all 6 African datasets"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models.models import (Base, User, Dataset, DatasetVersion, ProcessingTask,
                                 Review, Project, License, ClientAssignment, APIKey, AuditLog)
from app.auth import hash_password
from datetime import datetime, timedelta
import hashlib, secrets

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# --- Clear all ---
for model in [AuditLog, APIKey, ClientAssignment, Review, ProcessingTask,
              DatasetVersion, License, Project, Dataset, User]:
    db.query(model).delete()
db.commit()

# ── USERS ────────────────────────────────────────────────────────────────────
admin = User(name="Amara Diallo", email="admin@tineai.com",
             hashed_password=hash_password("admin123"), role="admin",
             organization="TINE AI")
supplier1 = User(name="Kofi Mensah", email="supplier@tineai.com",
                 hashed_password=hash_password("supplier123"), role="supplier",
                 organization="African Data Provider Ltd.")
supplier2 = User(name="Fatima Ouedraogo", email="fatima@tineai.com",
                 hashed_password=hash_password("supplier123"), role="supplier",
                 organization="Sahel Language Labs")
client1 = User(name="Dr. Sarah Chen", email="client@aichina.ai",
               hashed_password=hash_password("client123"), role="client",
               organization="AI Research Lab Ltd.")
client2 = User(name="Marcus Okonkwo", email="marcus@afrotech.io",
               hashed_password=hash_password("client123"), role="client",
               organization="AfroTech Solutions")
reviewer = User(name="Dr. Jean Mbeki", email="reviewer@tineai.com",
                hashed_password=hash_password("reviewer123"), role="reviewer",
                organization="TINE AI")

for u in [admin, supplier1, supplier2, client1, client2, reviewer]:
    db.add(u)
db.commit()

# ── PROJECTS ─────────────────────────────────────────────────────────────────
proj1 = Project(name="Cameroon Speech Recognition",
                description="ASR model for Cameroonian French with regional accent support",
                client_id=client1.id)
proj2 = Project(name="Pan-African NLP Benchmark",
                description="Multilingual benchmark covering 6 African languages",
                client_id=client2.id)
proj3 = Project(name="Lagos Speech Recognition V2",
                description="Improved Yoruba and Nigerian English ASR",
                client_id=client1.id)
for p in [proj1, proj2, proj3]:
    db.add(p)
db.commit()

# ── LICENSES ─────────────────────────────────────────────────────────────────
lic1 = License(
    name="Commercial AI Training — No Redistribution",
    license_type="Commercial",
    permitted_use="AI model training and fine-tuning for speech recognition",
    commercial_use=True,
    geographic_restriction="Global — except sanctioned regions",
    exclusivity=False,
    redistribution_allowed=False,
    model_restriction="Internal use only — no API resale of derived models",
    duration_days=180,
    access_start=datetime.utcnow(),
    access_end=datetime.utcnow() + timedelta(days=180),
    notes="Standard commercial training license. No sublicensing.",
    created_by_id=admin.id
)
lic2 = License(
    name="Research Non-Commercial License",
    license_type="Research",
    permitted_use="Academic research, benchmarking, non-commercial model evaluation",
    commercial_use=False,
    geographic_restriction="No restrictions",
    exclusivity=False,
    redistribution_allowed=False,
    model_restriction="Published models must cite TINE AI as data source",
    duration_days=365,
    access_start=datetime.utcnow(),
    access_end=datetime.utcnow() + timedelta(days=365),
    created_by_id=admin.id
)
for l in [lic1, lic2]:
    db.add(l)
db.commit()

# ── DATASETS ─────────────────────────────────────────────────────────────────
datasets = [
    # PRIMARY DEMO DATASET — Cameroon French (end-to-end story)
    Dataset(
        name="Cameroon French Speech Dataset",
        description="Spontaneous and read speech in Cameroonian French featuring regional expressions, code-switching with Camfranglais, and local Douala/Yaounde vocabulary. 10 speakers, varied age and gender.",
        data_type="audio", language="French", country="Cameroon",
        dialect="Cameroonian French", accent="Douala/Yaounde Urban",
        cultural_context="Urban Cameroonian daily speech — market interactions, family conversations, radio call-ins",
        collection_details="Recorded in Douala and Yaounde, Oct 2025. IRB approved. Speaker consent obtained.",
        source="University of Yaounde I partnership — 2025",
        file_size_mb=1450.0, file_formats="wav,mp3",
        status="available",
        quality_score=0.94,
        annotation_details="Sentence-level annotation. Speaker diarization complete. Phoneme labels for 30% of corpus. Camfranglais tags applied.",
        transcription_text="Bonjour mon ami, comment tu vas aujourd'hui? On va au marche acheter les tomates. Le prix ca monte trop ici a Douala. C'est comment? [Cameroon French — Douala urban dialect, code-switch detected]",
        translation_text="Good morning friend, how are you today? We're going to the market to buy tomatoes. Prices are rising too much here in Douala. What's going on?",
        diarization_info="3 speakers: Speaker A (female, 35, urban) 45%, Speaker B (male, 28, urban) 35%, Speaker C (male, 52, semi-rural) 20%",
        rights_info="TINE AI owns all rights. Licensed for AI training only. No redistribution.",
        permitted_uses="Speech recognition improvement, accent adaptation, dialect research, LLM training",
        restrictions="No public release of raw audio. No redistribution of derived datasets.",
        version="1.0", supplier_id=supplier1.id
    ),
    Dataset(
        name="Yoruba Morning Conversations",
        description="Field recordings of natural Yoruba morning conversations from Lagos. Covers greetings, market dialogues, and family interactions.",
        data_type="audio", language="Yoruba", country="Nigeria",
        dialect="Lagos Yoruba", accent="Urban Lagos",
        cultural_context="Urban Nigerian market and household settings",
        collection_details="Community field recordings. 8 speakers. Lagos Island and Mainland locations.",
        source="Community field recordings — Lagos, 2025",
        file_size_mb=1240.5, file_formats="wav,mp3",
        status="approved",
        quality_score=0.91,
        annotation_details="Speaker diarization complete. 3 speakers per clip. Age/gender metadata attached.",
        transcription_text="E kaaro, awa n lo si oja. Mo feran ede Yoruba gan-an. Oja naa tobi, awon eniyan po. [Yoruba morning greeting — Lagos dialect]",
        translation_text="Good morning, we are going to the market. I love the Yoruba language very much. The market is large, there are many people.",
        rights_info="TINE AI owns all rights. Licensed for AI training only.",
        permitted_uses="AI model training, dialect research, speech recognition improvement",
        version="1.2", supplier_id=supplier1.id
    ),
    Dataset(
        name="Swahili News Broadcast Archive",
        description="Broadcast-quality Swahili news audio from East African radio stations. Formal register with high clarity.",
        data_type="audio", language="Swahili", country="Kenya",
        dialect="Standard Swahili", accent="Nairobi Broadcast",
        cultural_context="East African broadcast media",
        collection_details="Licensed broadcast archive. 15 hours of content. 2024-2025.",
        source="Licensed broadcast archive — Nairobi, 2024-2025",
        file_size_mb=2100.0, file_formats="mp3,wav",
        status="under_review",
        quality_score=0.94,
        annotation_details="Sentence-level transcription complete. Speaker ID pending human review.",
        transcription_text="Habari za asubuhi. Leo tunaangalia hali ya hewa. Mvua zinatarajiwa. [Standard Swahili — Nairobi broadcast]",
        translation_text="Good morning news. Today we look at the weather. Rain is expected.",
        rights_info="TINE AI licensed content. Broadcast rights cleared.",
        permitted_uses="ASR training, news summarization, East African NLP",
        version="2.1", supplier_id=supplier2.id
    ),
    Dataset(
        name="Amharic Cultural Narratives",
        description="Traditional Ethiopian oral narratives and proverbs in Amharic with rich cultural metadata.",
        data_type="audio", language="Amharic", country="Ethiopia",
        dialect="Addis Ababa Amharic", accent="Highland Ethiopian",
        cultural_context="Traditional Ethiopian oral literature and proverb tradition",
        source="Ethiopian Heritage Foundation collaboration",
        file_size_mb=560.0, file_formats="wav",
        status="uploaded",
        rights_info="Jointly owned with Ethiopian Heritage Foundation. Restricted to non-commercial use.",
        permitted_uses="Cultural preservation, academic research, LLM cultural alignment",
        version="1.0", supplier_id=supplier2.id
    ),
    Dataset(
        name="Zulu Agricultural Instructional Video",
        description="Instructional videos in Zulu covering agricultural techniques in KwaZulu-Natal. Multi-speaker with visual context.",
        data_type="video", language="Zulu", country="South Africa",
        dialect="KwaZulu-Natal Zulu", accent="Rural KZN",
        cultural_context="Rural agricultural training content",
        source="Agricultural extension program — KZN, 2025",
        file_size_mb=4800.0, file_formats="mp4",
        status="approved",
        quality_score=0.83,
        annotation_details="Video scene segmentation complete. Subtitle track included.",
        transcription_text="Sawubona, namhlanje sizofunda ngokulima umbila. Kumqoka ukusebenzisa umhlabathi omuhle. [Zulu: Hello, today we learn about growing maize]",
        translation_text="Hello, today we will learn about growing maize. It is important to use good soil.",
        rights_info="TINE AI full rights. Commercial license available.",
        permitted_uses="Video captioning, multilingual AI, agricultural domain models",
        version="1.0", supplier_id=supplier1.id
    ),
    Dataset(
        name="Hausa Market Dialogue Image Collection",
        description="Annotated images from Northern Nigerian and Niger markets with Hausa text labels and product names.",
        data_type="image", language="Hausa", country="Nigeria",
        dialect="Northern Hausa", accent="Kano",
        cultural_context="Northern Nigerian/Sahel marketplace visual context",
        source="Field photography collection — Kano, 2025",
        file_size_mb=320.0, file_formats="jpg,png",
        status="processing",
        rights_info="TINE AI owns all rights.",
        permitted_uses="Visual AI, OCR, cultural context labeling",
        version="1.0", supplier_id=supplier2.id
    ),
]

for ds in datasets:
    db.add(ds)
db.commit()

# ── PROCESSING TASKS (Cameroon French) ───────────────────────────────────────
cam_ds = datasets[0]
db.expire_all()
cam_ds = db.query(Dataset).filter(Dataset.name == "Cameroon French Speech Dataset").first()
yor_ds = db.query(Dataset).filter(Dataset.name == "Yoruba Morning Conversations").first()

tasks = [
    ProcessingTask(dataset_id=cam_ds.id, task_type="transcription", status="completed",
                   file_name="douala_market_001.wav",
                   result_text="Bonjour mon ami, comment tu vas aujourd'hui? On va au marche acheter les tomates.",
                   confidence=0.94, completed_at=datetime.utcnow()),
    ProcessingTask(dataset_id=cam_ds.id, task_type="diarization", status="completed",
                   file_name="douala_market_001.wav",
                   result_text="Speaker 1: 0:00-0:45, Speaker 2: 0:45-1:30, Speaker 1: 1:30-2:15",
                   confidence=0.91, completed_at=datetime.utcnow()),
    ProcessingTask(dataset_id=cam_ds.id, task_type="quality_check", status="completed",
                   file_name="douala_market_001.wav",
                   result_text="SNR: 28dB | Clipping: None | Background noise: Low | Sample rate: 44100Hz",
                   confidence=0.96, completed_at=datetime.utcnow()),
    ProcessingTask(dataset_id=cam_ds.id, task_type="transcription", status="completed",
                   file_name="yaounde_family_002.wav",
                   result_text="On rentre a la maison maintenant. Les enfants attendent. Ca va bien ici.",
                   confidence=0.89, completed_at=datetime.utcnow()),
    ProcessingTask(dataset_id=cam_ds.id, task_type="diarization", status="completed",
                   file_name="yaounde_family_002.wav",
                   result_text="Speaker 1: 0:00-1:12, Speaker 2: 1:12-2:05",
                   confidence=0.88, completed_at=datetime.utcnow()),
    ProcessingTask(dataset_id=cam_ds.id, task_type="quality_check", status="completed",
                   file_name="yaounde_family_002.wav",
                   result_text="SNR: 24dB | Clipping: None | Background noise: Moderate | Sample rate: 44100Hz",
                   confidence=0.91, completed_at=datetime.utcnow()),
]
for t in tasks:
    db.add(t)

# ── HUMAN REVIEW ─────────────────────────────────────────────────────────────
review1 = Review(
    dataset_id=cam_ds.id, reviewer_id=reviewer.id, reviewer_name=reviewer.name,
    decision="pass",
    transcription_quality="correct",
    annotation_quality="correct",
    dialect_accuracy="correct",
    comments="Transcription accurately captures Cameroonian French phonology and Camfranglais code-switching. Diarization is clean. Quality scores are strong.",
    corrections="Minor: timestamp 1:42 — word boundary correction for 'c\'est comment' ligature."
)
db.add(review1)

# ── DATASET VERSIONS ─────────────────────────────────────────────────────────
v1 = DatasetVersion(dataset_id=cam_ds.id, version_number="v1",
                    status="approved", file_count=10,
                    change_notes="Initial release. 10 audio files, 2 hours total. Douala market and Yaounde family recordings.",
                    created_by_id=admin.id)
v2 = DatasetVersion(dataset_id=cam_ds.id, version_number="v2",
                    status="pending",
                    file_count=15,
                    change_notes="v2 adds 5 new files from Buea and Bamenda regions. Additional dialect coverage. Re-annotated 3 files from v1.",
                    created_by_id=admin.id)
db.add(v1); db.add(v2)
db.commit()

# ── ASSIGNMENTS ───────────────────────────────────────────────────────────────
a1 = ClientAssignment(
    client_id=client1.id, dataset_id=cam_ds.id,
    project_id=proj1.id, project_name=proj1.name,
    license_id=lic1.id, license_type="Commercial",
    permitted_use="AI model training — Cameroon speech recognition",
    access_start=datetime.utcnow(),
    access_end=datetime.utcnow() + timedelta(days=180)
)
a2 = ClientAssignment(
    client_id=client1.id, dataset_id=yor_ds.id,
    project_id=proj3.id, project_name=proj3.name,
    license_id=lic2.id, license_type="Research",
    permitted_use="Yoruba ASR fine-tuning — non-commercial",
    access_start=datetime.utcnow(),
    access_end=datetime.utcnow() + timedelta(days=365)
)
a3 = ClientAssignment(
    client_id=client2.id, dataset_id=cam_ds.id,
    project_id=proj2.id, project_name=proj2.name,
    license_id=lic2.id, license_type="Research",
    permitted_use="Pan-African benchmark — non-commercial evaluation only",
    access_start=datetime.utcnow(),
    access_end=datetime.utcnow() + timedelta(days=365)
)
# Expired assignment for demo scenario
a4 = ClientAssignment(
    client_id=client2.id, dataset_id=yor_ds.id,
    project_id=proj2.id, project_name=proj2.name,
    license_type="Research",
    permitted_use="Benchmark — expired license demo",
    access_start=datetime.utcnow() - timedelta(days=400),
    access_end=datetime.utcnow() - timedelta(days=30),   # EXPIRED
    is_active=True
)
for a in [a1, a2, a3, a4]:
    db.add(a)
db.commit()

# ── API KEY (pre-seeded for client1) ─────────────────────────────────────────
raw_key = "tine_demo_client_key_001"
key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
ak = APIKey(key_hash=key_hash, key_prefix="tine_demo_cl",
            client_id=client1.id, project_id=proj1.id, is_active=True)
db.add(ak)
db.commit()

# ── AUDIT SEED ────────────────────────────────────────────────────────────────
logs = [
    AuditLog(actor_name="Kofi Mensah", actor_role="supplier", action="UPLOAD_DATASET",
              entity_type="Dataset", entity_id=str(cam_ds.id),
              detail="Uploaded 'Cameroon French Speech Dataset' (French, Cameroon)"),
    AuditLog(actor_name="Amara Diallo", actor_role="admin", action="STATUS_CHANGE",
              entity_type="Dataset", entity_id=str(cam_ds.id),
              detail="'Cameroon French Speech Dataset' moved uploaded -> processing"),
    AuditLog(actor_name="Amara Diallo", actor_role="admin", action="AI_ENRICH",
              entity_type="Dataset", entity_id=str(cam_ds.id),
              detail="AI enrichment: transcription + diarization + quality check applied"),
    AuditLog(actor_name="Dr. Jean Mbeki", actor_role="reviewer", action="REVIEW_SUBMITTED",
              entity_type="Review", entity_id="1",
              detail="Review PASS — transcription accurate, dialect tags correct"),
    AuditLog(actor_name="Amara Diallo", actor_role="admin", action="STATUS_CHANGE",
              entity_type="Dataset", entity_id=str(cam_ds.id),
              detail="'Cameroon French Speech Dataset' moved under_review -> approved"),
    AuditLog(actor_name="Amara Diallo", actor_role="admin", action="VERSION_CREATED",
              entity_type="DatasetVersion", entity_id="1",
              detail="Version v1 created for 'Cameroon French Speech Dataset' (10 files)"),
    AuditLog(actor_name="Amara Diallo", actor_role="admin", action="ASSIGN_DATASET",
              entity_type="ClientAssignment", entity_id=str(a1.id),
              detail="Dataset assigned to Dr. Sarah Chen | project: Cameroon Speech Recognition | Commercial license"),
    AuditLog(actor_name="Dr. Sarah Chen", actor_role="client", action="GENERATE_API_KEY",
              entity_type="APIKey", entity_id="tine_demo_cl",
              detail="API key generated for client@aichina.ai | project: Cameroon Speech Recognition"),
    AuditLog(actor_name="API:tine_demo_cl", actor_role="client", action="API_ACCESS",
              entity_type="Dataset", entity_id=str(cam_ds.id),
              detail="API access: 'Cameroon French Speech Dataset' via key tine_demo_cl"),
]
for l in logs:
    db.add(l)
db.commit()
db.close()

print("TINE AI POC - Database seeded successfully!")
print("")
print("  Admin:    admin@tineai.com       / admin123")
print("  Supplier: supplier@tineai.com    / supplier123")
print("  Client:   client@aichina.ai      / client123")
print("  Client2:  marcus@afrotech.io     / client123")
print("  Reviewer: reviewer@tineai.com    / reviewer123")
print("")
print("  Demo API key: tine_demo_client_key_001")
print("  (use with dataset IDs 1-6)")
