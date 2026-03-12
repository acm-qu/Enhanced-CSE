#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STUDY_PLAN_PATH = path.join(__dirname, '..', 'public', 'New folder', 'study-plan.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'New folder', 'course-info-cache.json');

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
  console.log('Reading study plan...');
  const studyPlan = JSON.parse(fs.readFileSync(STUDY_PLAN_PATH, 'utf-8'));

  const courseInfoCache = {};
  const courses = studyPlan.courses || {};
  const courseIds = Object.keys(courses);

  console.log(`Found ${courseIds.length} courses. Starting to fetch course info...`);

  for (let i = 0; i < courseIds.length; i++) {
    const courseId = courseIds[i];
    const course = courses[courseId];
    const mybanner_url = course.sources?.mybanner_url;

    if (!mybanner_url) {
      console.log(`[${i + 1}/${courseIds.length}] ${courseId} - no banner URL, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${courseIds.length}] Fetching ${courseId}...`);
    const info = await fetchCourseInfo(mybanner_url);

    if (info) {
      courseInfoCache[courseId] = info;
      console.log(`  ✓ Cached`);
    } else {
      console.log(`  ✗ Failed to fetch`);
    }

    // Rate limiting - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nSuccessfully cached ${Object.keys(courseInfoCache).length} courses`);
  console.log(`Writing to ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(courseInfoCache, null, 2));
  console.log('Done!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
