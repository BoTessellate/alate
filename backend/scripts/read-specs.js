const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: 'ntn_h7843339239bj4WOTI5Fct4RjbqPpf1EFScIR5OOb5D2TQ' });

async function extractText(richText) {
  return richText?.map(t => t.plain_text).join('') || '';
}

async function readBlock(blockId, indent = 0) {
  const children = await notion.blocks.children.list({ block_id: blockId });
  let content = '';

  for (const block of children.results) {
    const spaces = '  '.repeat(indent);

    switch (block.type) {
      case 'paragraph':
        const text = await extractText(block.paragraph.rich_text);
        if (text) content += `${spaces}${text}\n`;
        break;
      case 'heading_1':
        content += `\n${spaces}# ${await extractText(block.heading_1.rich_text)}\n`;
        break;
      case 'heading_2':
        content += `\n${spaces}## ${await extractText(block.heading_2.rich_text)}\n`;
        break;
      case 'heading_3':
        content += `\n${spaces}### ${await extractText(block.heading_3.rich_text)}\n`;
        break;
      case 'bulleted_list_item':
        content += `${spaces}- ${await extractText(block.bulleted_list_item.rich_text)}\n`;
        break;
      case 'numbered_list_item':
        content += `${spaces}1. ${await extractText(block.numbered_list_item.rich_text)}\n`;
        break;
      case 'toggle':
        content += `\n${spaces}### ${await extractText(block.toggle.rich_text)}\n`;
        if (block.has_children) {
          content += await readBlock(block.id, indent + 1);
        }
        break;
      case 'child_database':
        content += `\n${spaces}[Database: ${block.child_database.title}]\n`;
        break;
      case 'code':
        const code = await extractText(block.code.rich_text);
        content += `\n${spaces}\`\`\`${block.code.language}\n${code}\n\`\`\`\n`;
        break;
    }

    if (block.has_children && block.type !== 'toggle') {
      content += await readBlock(block.id, indent + 1);
    }
  }

  return content;
}

async function readNotionSpecs() {
  try {
    const pageId = '25d1d37fdbe780118949e39b803f5690';

    console.log('Reading Notion page: bits of tessellate\n');

    const page = await notion.pages.retrieve({ page_id: pageId });
    const title = page.properties.title?.title?.map(t => t.plain_text).join('') || 'Untitled';

    let content = `# ${title}\n\n`;
    content += await readBlock(pageId);

    // Save to file
    const outputPath = 'C:\\Users\\mailt\\Documents\\alate\\notion-specs.md';
    fs.writeFileSync(outputPath, content);

    console.log('Content saved to:', outputPath);
    console.log('\n--- PREVIEW ---\n');
    console.log(content.substring(0, 2000));
    console.log('\n... (full content saved to file)');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

readNotionSpecs();
