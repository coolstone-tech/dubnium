const assert = require('assert').strict;
const Dubnium = require('./v4');
const Collection = require('./v4/collection');
const Template = require('./v4/template');
const path = require('path');
const { rm, utimes, readFile } = require('fs/promises');

const TEST_DIR = path.join(__dirname, 'test_db');

async function runTests() {
    console.log('🚀 Starting Dubnium v4 Unit Tests...\n');
    const db = new Dubnium(TEST_DIR, { ext: 'json', trash: path.join(TEST_DIR, '.trash'), versioning: { enabled: true, limit: 3 } });

    try {
        // --- Test 1: CRUD Operations ---
        console.log('🧪 Test 1: Basic CRUD');
        await db.create('user1', { name: 'Alice', age: 30 });
        const data = await db.read('user1', true);
        assert.equal(data.name, 'Alice', 'Data name mismatch');
        assert.equal(data.age, 30, 'Data age mismatch');
        console.log('✅ Passed: Basic CRUD');

        // --- Test 2: Atomic Updates (Race Condition Guard) ---
        console.log('\n🧪 Test 2: Atomic Updates (Concurrency)');
        await Promise.all([
            db.get('user1').kv('age', 31),
            db.get('user1').kv('city', 'Santa Cruz')
        ]);
        const updated = await db.read('user1', true);
        assert.equal(updated.age, 31, 'Atomic age update failed');
        assert.equal(updated.city, 'Santa Cruz', 'Atomic city update failed');
        console.log('✅ Passed: Atomic Concurrency');

        // --- Test 3: Path Security (Jailbreak Protection) ---
        console.log('\n🧪 Test 3: Security Guards');
        try {
            await db.read('../../etc/passwd');
            assert.fail('Should have thrown a security error');
        } catch (e) {
            console.log('Caught expected security error:', e.message);
            assert.ok(e.message.includes('Access denied'), 'Wrong error message for security violation');
        }
        console.log('✅ Passed: Path Security');

        // --- Test 4: Versioning System ---
        console.log('\n🧪 Test 4: Versioning & Limits');
        await db.get('user1').write({ version: 1 });
        await db.get('user1').write({ version: 2 });
        await db.get('user1').write({ version: 3 });
        await db.get('user1').write({ version: 4 });

        const record = db.get('user1');
        const versionsDir = path.join(TEST_DIR, '.versions', 'user1');
        const { readdir } = require('fs/promises');
        const files = await readdir(versionsDir);
        
        // Should only keep 3 versions based on config limit
        assert.equal(files.length, 3, `Expected 3 versions, found ${files.length}`);
        console.log('✅ Passed: Versioning Limits');

        // --- Test 5: Async Filter (getFromValue) ---
        console.log('\n🧪 Test 5: Search & Async Filtering');
        await db.create('search_test', { bio: 'Student at UCSC' });
        const results = await db.getFromValue('UCSC', { tagOnly: true });
        assert.ok(results.includes('search_test'), 'Search failed to find value');
        console.log('✅ Passed: Search Logic');

        // --- Test 6: Iteration Protocol ---
        console.log('\n🧪 Test 6: Async Iteration');
        const tags = [];
        for await (const record of db) {
            tags.push(record.tag);
        }
        assert.ok(tags.includes('user1'), 'Iteration missing user1');
        assert.ok(tags.includes('search_test'), 'Iteration missing search_test');
        console.log('✅ Passed: Async Iteration');

        // --- Test 7: kv Method ---
        console.log('\n🧪 Test 7: kv Method')
        await db.get('user1').kv('hobby', 'coding');
        const hobby = (await db.get('user1').read()).hobby;
        assert.equal(hobby, 'coding', 'kv method failed');
        console.log('✅ Passed: kv Method');

        // --- Test 8: Error Handling ---
        console.log('\n🧪 Test 8: Error Handling');
        try {
            await db.read('nonexistent');
            assert.fail('Should have thrown an error for non-existent record');
        } catch (e) {
            console.log('Caught expected error:', e.message);
            assert.ok(e.message.includes('does not exist'), 'Wrong error message for missing record');
        }
        console.log('✅ Passed: Error Handling');

        // --- Test 9: Append/Prepend/Truncate ---
        console.log('\n🧪 Test 9: Append/Prepend/Truncate');
        const tdb = new Dubnium(path.join(TEST_DIR, 'textdb'), { ext: 'txt' });
        await tdb.create('file1', 'Hello');
        await tdb.get('file1').append(' World');
        let content = await tdb.get('file1').read();
        assert.equal(content, 'Hello World', 'Append failed');
        console.log('✅ Passed: Append');

        await tdb.get('file1').prepend('Say: ');
        content = await tdb.get('file1').read();
        assert.equal(content, 'Say: Hello World', 'Prepend failed');
        console.log('✅ Passed: Prepend');

        await tdb.get('file1').truncate(5);
        content = await tdb.get('file1').read();
        assert.equal(content, 'Say: ', 'Truncate failed');
        console.log('✅ Passed: Truncate');

        // --- Test 10: Record Deletion & Trash ---
        console.log('\n🧪 Test 10: Deletion & Trash');
        await db.delete('user1');
        try {
            await db.read('user1');
            assert.fail('Should have thrown an error for deleted record');
        } catch (e) {
            console.log('Caught expected error:', e.message);
            assert.ok(e.message.includes('does not exist'), 'Wrong error message for deleted record');
        }

        const trashPath = path.join(db.config.trash, 'user1.json');
        const { access } = require('fs/promises');
        await access(trashPath);
        console.log('✅ Passed: Deletion & Trash');

        // --- Test 11: Event Emission ---
        console.log('\n🧪 Test 11: Event Emission');
        let createEmitted = false;
        db.on('create', (tag) => {
            if (tag === 'event_test') createEmitted = true;
        });
        await db.create('event_test', { test: true });
        assert.ok(createEmitted, 'Create event was not emitted');
        console.log('✅ Passed: Event Emission');

        // --- Test 12: Empty & isEmpty Methods ---
        console.log('\n🧪 Test 12: Empty & isEmpty Methods');
        await db.create('empty_test', {});
        const emptyRecord = db.get('empty_test');
        assert.ok(await emptyRecord.isEmpty(), 'isEmpty should return true for empty record');
        await emptyRecord.write('Not empty anymore');
        assert.ok(!await emptyRecord.isEmpty(), 'isEmpty should return false for non-empty record');
        await emptyRecord.empty();
        assert.ok(await emptyRecord.isEmpty(), 'isEmpty should return true after emptying record');
        console.log('✅ Passed: Empty & isEmpty Methods');

        // --- Test 13: Alias ---
        console.log('\n🧪 Test 13: Method Aliases');
        db.alias('r', 'read');
        const aliasData = await db.r('search_test', true);
        assert.equal(aliasData.bio, 'Student at UCSC', 'Alias method failed');
        console.log('✅ Passed: Method Aliases');

        // --- Test 14: Delete Large & Delete Old ---
        console.log('\n🧪 Test 14: Delete Large & Old Records');
        const largeData = 'x'.repeat(10 * 1024 * 1024); // 10 MB
        await db.create('large_record', largeData);
        await db.deleteLarge(5 * 1024 * 1024); // Delete records larger than 5 MB
        try {
            await db.read('large_record');
            assert.fail('Should have thrown an error for deleted large record');
        } catch (e) {
            console.log('Caught expected error for large record deletion:', e.message);
            assert.ok(e.message.includes('does not exist'), 'Wrong error message for deleted large record');
        }

        const oldRecordPath = path.join(TEST_DIR, 'old_record.json');
        await db.create('old_record', { old: true });
        const pastTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        await utimes(oldRecordPath, pastTime/1000, pastTime/1000);
        await db.deleteOld({ d: 5 }); // Delete records older than 5 days
        try {
            await db.read('old_record');
            assert.fail('Should have thrown an error for deleted old record');
        } catch (e) {
            console.log('Caught expected error for old record deletion:', e.message);
            assert.ok(e.message.includes('does not exist'), 'Wrong error message for deleted old record');
        }
        console.log('✅ Passed: Delete Large & Old Records');


        // --- Test 15: Set Tag Method ---
        console.log('\n🧪 Test 15: Set Tag Method');
        await db.create('tag_test', { tag: 'test' });
        const recordToRename = db.get('tag_test');
        await recordToRename.setTag('renamed_test');
        try {
            await db.read('tag_test');
            assert.fail('Should have thrown an error for old tag after renaming');
        } catch (e) {
            console.log('Caught expected error for old tag after renaming:', e.message);
            assert.ok(e.message.includes('does not exist'), 'Wrong error message for old tag after renaming');
        }
        const renamedData = await db.read('renamed_test', true);
        assert.equal(renamedData.tag, 'test', 'Data mismatch after renaming tag');
        console.log('✅ Passed: Set Tag Method');

        // --- Test 16: Sync With Method ---
        console.log('\n🧪 Test 16: Sync With Method');
        await db.create('sync_source', { value: 'source' });
        await recordToRename.syncWith('sync_source');
        const syncedData = await recordToRename.read();
        assert.equal(syncedData.value, 'source', 'Data mismatch after syncing with another record');
        console.log('✅ Passed: Sync With Method');

        // --- Test 17: Symlink ---
        console.log('\n🧪 Test 17: Symlink Method');
        await db.create('original', { data: 'original' });
        await db.get('original').symlink(path.join(TEST_DIR, 'symlinked'));
        const symlinkedData = await readFile(path.join(TEST_DIR, 'symlinked'), 'utf-8');
        assert.equal(symlinkedData, '{"data":"original"}', 'Data mismatch for symlinked record');
        console.log('✅ Passed: Symlink Method');

        // --- Test 18: Collections ---
        const coll = new Collection(db, 'my_collection', {
            value:0
        });
        await coll.create('item1', { value: 1 });
        try {
            await coll.create('item2', { value: "" });
            assert.fail('Should have thrown an error for invalid schema');
        } catch (e) {
            console.log('Caught expected error for invalid schema:', e.message);
            assert.ok(e.message.includes('does not match schema'), 'Wrong error message for invalid schema');
        }
        const item1Data = JSON.parse(await db.read('item1'));
        assert.equal(item1Data.value, 1, 'Data mismatch in collection item');
        console.log('✅ Passed: Collections');

        // --- Test 19: Templates ---
        console.log('\n🧪 Test 19: Templates');
        const jsonTemplate = new Template({
            name: 'string',
            age: 0
        });

        assert.ok(Object.values(jsonTemplate.use('Bob', 25))[0] == 'Bob', 'Template did not produce expected output for valid data. Produced: ' + JSON.stringify(jsonTemplate.use('Bob', 25)));

        const stringTemplate = new Template('{0}, {1}!');
        assert.ok(stringTemplate.use('Hello', 'World') === 'Hello, World!', 'Template did not produce expected output for string template');
        console.log('✅ Passed: Templates');

        // --- Test 20: Has ---
        console.log('\n🧪 Test 20: Has Method');
        await db.create('has_test', { value: 'test' });
        assert.ok(await db.has('has_test'), 'Has method failed to detect existing record');
        assert.ok(!(await db.has('non_existent')), 'Has method incorrectly detected non-existent record');
        console.log('✅ Passed: Has Method');


    } catch (error) {
        console.error('\n❌ Test Suite Failed:');
        console.error(error);
        process.exit(1);
    } finally {
        if(process.argv.includes('--no-cleanup')) return console.log('\n⚠️ Skipping cleanup due to --no-cleanup flag.');
        console.log('\n🧹 Cleaning up test directory...');
        await rm(TEST_DIR, { recursive: true, force: true });
        console.log('🏁 All tests complete.');
    }
}

runTests();