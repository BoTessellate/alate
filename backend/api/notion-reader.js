const { Client } = require('@notionhq/client');

const notion = new Client({ auth: 'ntn_h7843339239bj4WOTI5Fct4RjbqPpf1EFScIR5OOb5D2TQ' });

async function readNotionContent() {
  try {
    const pageId = '25d1d37fdbe780118949e39b803f5690';
    const databaseId = '2a21d37fdbe781a29330fb6d2a2982e6';

    console.log('=== FETCHING PROJECTS DATABASE ===\n');

    // Fetch database using search
    const response = await notion.search({
      filter: {
        value: 'database',
        property: 'object'
      }
    });

    console.log('Databases found:', response.results.length);

    // Get the specific database
    const db = await notion.databases.retrieve({ database_id: databaseId });
    console.log('\nDatabase Schema:');
    console.log(JSON.stringify(db.properties, null, 2));

    // Get pages in the database using blocks API
    console.log('\n\n=== READING DATABASE CONTENT ===\n');

    const blocks = await notion.blocks.children.list({
      block_id: databaseId,
      page_size: 100
    });

    console.log('Found', blocks.results.length, 'items in database');
    console.log(JSON.stringify(blocks, null, 2));

    // Fetch toggle sections
    console.log('\n\n=== FETCHING TOGGLE SECTIONS ===\n');
    const pageBlocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    });

    for (const block of pageBlocks.results) {
      if (block.type === 'toggle') {
        const title = block.toggle.rich_text.map(t => t.plain_text).join('');
        console.log(`\n--- ${title} ---`);
        console.log('Block ID:', block.id);

        // Fetch children of toggle
        const children = await notion.blocks.children.list({
          block_id: block.id,
        });

        console.log('Content blocks:', children.results.length);
        for (const child of children.results) {
          console.log(`\nBlock type: ${child.type}`);
          console.log(JSON.stringify(child, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

readNotionContent();
