cdn
===

standalone node.js image CDN

Quickstart:
Open up cdn.js in your favorite editor, edit the config object (most importantly update your base_path and ensure that there is a writeable folder named `cache` underneath it):
```
var config = {
	// root directory of your project, cached images will be stored under here
	base_path: '/path/to/your/project/',
	// toggles console verbosity
	debug: false,
	// false if no SSL support, or uncomment object below and add your paths
	ssl: false,
	/*
	ssl: {
		key: '/path/to/ca.key',
		crt: '/path/to/ca.crt'
	},
	*/
	// port to run cdn on
	port: 6523,
	// domains that you will accept images from
	whitelisted_domains: ['s3.amazonaws.com', 'lnkd.licdn.com', 'maps.googleapis.com','msnbcmedia3.msn.com'],
	// set to whatever you want
	default_dimensions: '100x100'
};
```

```
$ npm install
$ node cdn.js
```
Open up http://localhost:6523/600x600/aHR0cDovL21zbmJjbWVkaWEzLm1zbi5jb20vai9tc25iYy9Db21wb25lbnRzL1Bob3Rvcy8wNzA4MDIvMDcwODAyX29yYW5ndXRhbl9obWVkXzEwYS5obWVkaXVtLmpwZw== 
in your browser