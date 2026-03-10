// Generate a test visitor token for file access verification
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '7WNY0G2duEskv+NXSlppbIZV1bHuiSIFbjy5rFLTE59t1GmwYQ/pp/zt4JDR/uzc';
const filename = 'test-security-file.txt';
const visitorId = 'test-visitor-123';

const token = jwt.sign(
  {
    visitorId,
    filename,
    type: 'visitor_file_access',
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log(token);
