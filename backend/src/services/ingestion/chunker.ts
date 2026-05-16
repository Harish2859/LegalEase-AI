import { randomUUID } from 'crypto';

interface RawPage {
  text: string;
  pageNumber: number;
}

export const createParentChildChunks = (parsedPages: RawPage[]) => {
  const chunks: any[] = [];
  const fullText = parsedPages.map(p => p.text).join('\n');
  const sections = fullText.split(/\n(?=#+\s)/);

  sections.forEach((sectionContent) => {
    const parentId = randomUUID();
    const sectionTitle = sectionContent.split('\n')[0].replace(/#+\s/, '').trim();

    chunks.push({
      id: parentId,
      content: sectionContent,
      chunkType: 'parent',
      sectionTitle,
      parentId: null,
    });

    const childSize = 1000;
    const overlap = 150;

    for (let i = 0; i < sectionContent.length; i += (childSize - overlap)) {
      chunks.push({
        id: randomUUID(),
        content: sectionContent.substring(i, i + childSize),
        chunkType: 'child',
        sectionTitle,
        parentId,
      });
    }
  });

  return chunks;
};
