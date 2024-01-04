# Update time on edit plugin

This plugin update on save the metadata of the file with the time it was updated, and the time of creation if there is none (useful for new files).

Here is a list of feature this plugin provides :
- Keep in sync the `mtime` (last modified time) in a property key (default to `updated`)
- Keep in sync the `ctime` (file creation time) in a property key (default to `created`)
- Customize the date format, default to obsidian date format for property display
- Supports string and number property data types, the later being useful for Unix timestamps
- Ignore folder for all update, useful for template files
- Ignore folder for the creation property
- Works on mobile & desktop

This plugin will read the `ctime` and `mtime` from obsidian, and thus, the file system. **If file change from an external source, the header keys will be updated**.

Remember to backup your vault since this plugin will modify files.