class FileIcons {
  static getIcon(item) {
    if (item.isDirectory) {
      return '📁';
    }

    const extension = item.extension.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'readme':
        return '📄';
      
      case 'doc':
      case 'docx':
        return '📝';
      
      case 'xls':
      case 'xlsx':
      case 'csv':
        return '📊';
      
      case 'pdf':
        return '📕';
      
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return '🖼️';
      
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return '🎬';
      
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return '📦';
      
      case 'js':
      case 'html':
      case 'css':
      case 'json':
      case 'xml':
        return '💻';
      
      default:
        return '📄';
    }
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileIcons;
}

