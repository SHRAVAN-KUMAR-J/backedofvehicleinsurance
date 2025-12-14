const { v2: dropbox } = require('dropbox');

const dbx = new dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

// Function to upload a file and return the shareable link
const uploadFileToDropbox = async (filePath, fileName, folderPath = '/vehicle_insurance/payments') => {
  try {
    // Ensure folder ends with slash for correct path
    const fullPath = `${folderPath}/${fileName}`;
    // Upload the file
    const uploadResult = await dbx.filesUpload({ path: fullPath, contents: require('fs').readFileSync(filePath) });
    const filePathLower = uploadResult.result.path_lower;
    // Create a shared link for the uploaded file
    const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: filePathLower });
    return {
      path: filePathLower,
      url: sharedLinkResult.result.url,
    };
  } catch (error) {
    throw new Error(`Dropbox upload failed: ${error.message}`);
  }
};

// Function to get shareable URL for an existing file path
const getShareableUrl = async (filePath) => {
  try {
    const sharedLinkResult = await dbx.sharingCreateSharedLinkWithSettings({ path: filePath });
    return sharedLinkResult.result.url;
  } catch (error) {
    if (error.error && error.error.error_summary === 'shared_link_already_exists') {
      // If link already exists, list existing shared links and find one for this path
      const linksResult = await dbx.sharingListSharedLinks({ path: filePath });
      const existingLink = linksResult.result.links.find(link => link.path_lower === filePath);
      if (existingLink) {
        return existingLink.url;
      }
    }
    throw new Error(`Failed to get shareable URL: ${error.message}`);
  }
};

module.exports = { dropbox: dbx, uploadFileToDropbox, getShareableUrl };