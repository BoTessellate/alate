import { Client } from '@notionhq/client';

const notion = new Client({ auth: 'ntn_h7843339239bj4WOTI5Fct4RjbqPpf1EFScIR5OOb5D2TQ' });

async function readNotionContent() {
  try {
    const pageId = '25d1d37fdbe780118949e39b803f5690';
    const databaseId = '2a21d37fdbe781a29330fb6d2a2982e6';

    console.log('=== FETCHING PROJECTS DATABASE ===\n');

    // Fetch database entries
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    console.log(`Found ${response.results.length} projects:\n`);

    for (const page of response.results) {
      if ('properties' in page) {
        console.log('\n--- Project ---');
        console.log('ID:', page.id);
        console.log('URL:', page.url);

        // Extract properties
        for (const [key, value] of Object.entries(page.properties)) {
          console.log(`${key}:`, JSON.stringify(value, null, 2));
        }
      }
    }

    // Fetch toggle sections
    console.log('\n\n=== FETCHING TOGGLE SECTIONS ===\n');
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    });

    for (const block of blocks.results) {
      if ('type' in block && block.type === 'toggle' && 'toggle' in block) {
        const title = block.toggle.rich_text.map((t: any) => t.plain_text).join('');
        console.log(`\n--- ${title} ---`);
        console.log('Block ID:', block.id);

        // Fetch children of toggle
        const children = await notion.blocks.children.list({
          block_id: block.id,
        });

        console.log('Content:');
        for (const child of children.results) {
          if ('type' in child) {
            console.log(`  - ${child.type}:`, JSON.stringify(child, null, 2));
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

readNotionContent();
