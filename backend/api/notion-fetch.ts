import { Client } from '@notionhq/client';

const notion = new Client({ auth: 'ntn_h7843339239bj4WOTI5Fct4RjbqPpf1EFScIR5OOb5D2TQ' });

async function fetchNotionData() {
  try {
    const pageId = '25d1d37fdbe780118949e39b803f5690';

    console.log('Fetching page...');
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Page data:', JSON.stringify(page, null, 2));

    console.log('\n\nFetching page blocks...');
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    });
    console.log('Blocks:', JSON.stringify(blocks, null, 2));

    // Check for databases in the blocks
    for (const block of blocks.results) {
      if ('type' in block && block.type === 'child_database') {
        console.log('\n\nFound database:', block.id);
        try {
          const database = await notion.databases.retrieve({ database_id: block.id });
          console.log('Database details:', JSON.stringify(database, null, 2));
        } catch (dbError) {
          console.error('Error fetching database:', dbError);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fetchNotionData();
