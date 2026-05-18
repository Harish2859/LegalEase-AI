CREATE TABLE "RedFlag" (
  "id"             TEXT NOT NULL,
  "documentId"     TEXT NOT NULL,
  "flagType"       TEXT NOT NULL,
  "severity"       TEXT NOT NULL,
  "explanation"    TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "sectionTitle"   TEXT,
  "pageStart"      INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RedFlag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RedFlag_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
