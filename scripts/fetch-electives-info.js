#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ELECTIVES_PATH = path.join(__dirname, '..', 'public', 'New folder', 'electives.json');
const CACHE_PATH = path.join(__dirname, '..', 'public', 'New folder', 'course-info-cache.json');

async function fetchCourseInfo(url) {
  try {
    const response = await fetch(`http://localhost:3000/api/v1/courses/info?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.course || null;
  } catch (error) {
    console.warn(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Reading electives...');
  const electivesData = JSON.parse(fs.readFileSync(ELECTIVES_PATH, 'utf-8'));
  const electives = electivesData.electives || [];

  const electiveInfoCache = {};

  console.log(`Found ${electives.length} elective courses to fetch...`);

  for (let i = 0; i < electives.length; i++) {
    const elective = electives[i];
    const courseId = elective.id;
    const mybanner_url = elective.sources?.mybanner_url;

    if (!mybanner_url) {
      console.log(`[${i + 1}/${electives.length}] ${courseId} - no banner URL, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${electives.length}] Fetching ${courseId}...`);
    const info = await fetchCourseInfo(mybanner_url);

    if (info) {
      electiveInfoCache[courseId] = info;
      console.log(`  ✓ Cached`);
    } else {
      console.log(`  ✗ Failed to fetch`);
    }

    // Rate limiting - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Merge with existing cache if it exists
  let existingCache = {};
  if (fs.existsSync(CACHE_PATH)) {
    existingCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  }

  const mergedCache = { ...existingCache, ...electiveInfoCache };

  console.log(`\nSuccessfully cached ${Object.keys(electiveInfoCache).length} electives`);
  console.log(`Total cached courses: ${Object.keys(mergedCache).length}`);
  console.log(`Writing to ${CACHE_PATH}...`);
  fs.writeFileSync(CACHE_PATH, JSON.stringify(mergedCache, null, 2));
  console.log('Done!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
