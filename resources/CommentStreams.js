﻿/*
 * Copyright (c) 2016 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

var commentstreams_controller = ( function () {
	'use strict';

	return {
		baseUrl: null,
		imagepath: null,
		targetComment: null,
		isLoggedIn: false,
		canComment: false,
		moderatorEdit: false,
		moderatorDelete: false,
		moderatorFastDelete: false,
		showLabels: false,
		userDisplayName: null,
		newestStreamsOnTop: false,
		initiallyCollapsed: false,
		areNamespaceEnabled: false,
		enableVoting: false,
		enableWatchlist: false,
		comments: [],
		spinnerOptions: {
			lines: 11, // The number of lines to draw
			length: 8, // The length of each line
			width: 4, // The line thickness
			radius: 8, // The radius of the inner circle
			corners: 1, // Corner roundness (0..1)
			rotate: 0, // The rotation offset
			direction: 1, // 1: clockwise, -1: counterclockwise
			color: '#000', // #rgb or #rrggbb or array of colors
			speed: 1, // Rounds per second
			trail: 60, // ƒfterglow percentage
			shadow: false, // Whether to render a shadow
			hwaccel: false, // Whether to use hardware acceleration
			className: 'spinner', // The CSS class to assign to the spinner
			zIndex: 2e9, // The z-index (defaults to 2000000000)
			top: '50%', // Top position relative to parent
			left: '50%' // Left position relative to parent
		},
		initialize: function () {
			this.baseUrl = window.location.href.split( /[?#]/ )[ 0 ];
			this.imagepath = mw.config.get( 'wgExtensionAssetsPath' ) +
				'/CommentStreams/images/';
			if ( window.location.hash ) {
				var hash = window.location.hash.substring( 1 );
				var queryIndex = hash.indexOf( '?' );
				if ( queryIndex !== -1 ) {
					hash = hash.substring( 0, queryIndex );
				}
				this.targetComment = hash;
			}
			this.isLoggedIn = mw.config.get( 'wgUserName' ) !== null;
			var config = mw.config.get( 'CommentStreams' );
			this.canComment = config.canComment;
			this.moderatorEdit = config.moderatorEdit;
			this.moderatorDelete = config.moderatorDelete;
			this.moderatorFastDelete = this.moderatorDelete ?
				config.moderatorFastDelete : false;
			this.showLabels = config.showLabels;
			this.userDisplayName = config.userDisplayName;
			this.newestStreamsOnTop = config.newestStreamsOnTop;
			this.initiallyCollapsed = config.initiallyCollapsed;
			this.areNamespaceEnabled = config.areNamespaceEnabled;
			this.enableVoting = config.enableVoting;
			this.enableWatchlist = config.enableWatchlist;
			this.comments = config.comments;
			this.setupDivs();
			this.addInitialComments();
			if ( this.targetComment ) {
				this.scrollToAnchor( this.targetComment );
			}
		},
		scrollToAnchor: function ( id ) {
			var element = $( '#' + id );
			if ( element.length ) {
				$( 'html,body' ).animate( { scrollTop: element.offset().top }, 'slow' );
			}
		},
		setupDivs: function () {
			var self = this;

			if ( self.areNamespaceEnabled && $( '#cs-comments.cs-comments' ).length === 0 ) {
				var mainDiv = $( '<div>' ).attr( 'class', 'cs-comments' ).attr( 'id', 'cs-comments' );
				mainDiv.insertAfter( '#catlinks' );
			}
			$( '.cs-comments' ).each( function () {
				var commentDiv = $( this );

				var headerDiv = $( '<div>' ).attr( 'class', 'cs-header' );
				// For backwards compatibility. Please remove in ver 6.0
				if ( commentDiv.attr( 'id' ) === 'cs-comments' ) {
					headerDiv.attr( 'id', 'cs-header' );
				}
				commentDiv.append( headerDiv );

				var footerDiv = $( '<div>' ).attr( 'class', 'cs-footer' );
				// For backwards compatibility. Please remove in ver 6.0
				if ( commentDiv.attr( 'id' ) === 'cs-comments' ) {
					footerDiv.attr( 'id', 'cs-footer' );
				}
				commentDiv.append( footerDiv );

				if ( self.canComment ) {
					
					/* START Neayi - we create a special addButton zone, and we put it always at the bottom					

					var addButton = $( '<button>' )
						.attr( {
							type: 'button',
							class: 'cs-add-button',
							title: mw.message( 'commentstreams-buttontext-add' ),
							'data-toggle': 'tooltip'
						} )
						.addClass( 'cs-button' );
					// For backwards compatibility. Please remove in ver 6.0
					if ( commentDiv.attr( 'id' ) === 'cs-comments' ) {
						addButton.attr( 'id', 'cs-add-button' );
					}
					var addImage = $( '<img>' )
						.attr( {
							title: mw.message( 'commentstreams-buttontooltip-add' ),
							src: self.imagepath + 'comment_add.png'
						} );
					addButton.append( addImage );
					if ( self.showLabels ) {
						var addLabel = $( '<span>' )
							.text( mw.message( 'commentstreams-buttontext-add' ) )
							.addClass( 'cs-comment-button-label' );
						addButton.append( addLabel );
					}

					if ( self.newestStreamsOnTop ) {
						headerDiv.append( addButton );
					} else {
						footerDiv.append( addButton );
					}

					END Neayi */

					// START Neayi
					var addButton = self.createNeayiAddButton();

					// For backwards compatibility. Please remove in ver 6.0
					if ( commentDiv.attr( 'id' ) === 'cs-comments' ) {
						addButton.attr( 'id', 'cs-add-button' );
					}

					footerDiv.append( addButton );
					// END Neayi

					addButton.click( function () {
						self.showNewCommentStreamBox( this );
					} );
				} 
				
				// Start Neayi : When the user is not connected, we show a button anyway
				else {
					var addButtonDiv = $( '<div> ' )
						.addClass( 'cs-add-div' );

					var addButton = $( '<button>' )
						.attr( {
							type: 'button',
							id: 'cs-add-button',
							title: mw.message( 'commentstreams-buttontext-Neayi-connecttocomment' ),
							'data-toggle': 'tooltip'
						} )
						.addClass( 'cs-button rounded' );

					var addCommentFA = $( '<i>' )
						.addClass( 'fas fa-comment' );
					addButton.append( addCommentFA );

					if ( self.showLabels ) {
						var addLabel = $( '<span>' )
							.text( mw.message( 'commentstreams-buttontext-Neayi-connecttocomment' ) )
							.addClass( 'cs-comment-button-label' );
						addButton.append( addLabel );
					}

					addButtonDiv.append( addButton );

					footerDiv.append( addButtonDiv );

					addButton.click( function () {
						var wgPageName = mw.config.get( 'wgPageName' );
						window.location = mediaWiki.util.getUrl( "Special:Connexion", { returnto: wgPageName } );
					} );

				}
				// END Neayi
			} );
		},
		addInitialComments: function () {
			var self = this;
			var parentIndex;
			for ( parentIndex in this.comments ) {
				var parentComment = this.comments[ parentIndex ];
				var commenthtml = this.formatComment( parentComment );
				var location = $( commenthtml )
					.insertBefore( '#' + parentComment.cst_id + ' .cs-footer' );
				var childIndex;
				for ( childIndex in parentComment.children ) {
					var childComment = parentComment.children[ childIndex ];
					commenthtml = this.formatComment( childComment );
					$( commenthtml ).insertBefore(
						$( location ).find( '.cs-stream-footer' ) );
				}
			}

			if ( this.initiallyCollapsed ) {
				$( '.cs-stream' ).each( function () {
					self.collapseStream( $( this ), $( this )
						.find( '.cs-toggle-button' ) );
				} );
			}
		},
		collapseStream: function ( stream, button ) {
			stream.find( '.cs-reply-comment' ).addClass( 'cs-hidden' );
			stream.find( '.cs-head-comment .cs-comment-body' ).addClass( 'cs-hidden' );
			stream.find( '.cs-stream-footer .cs-reply-button' ).addClass( 'cs-hidden' );
			$( stream ).addClass( 'cs-collapsed' );
			$( stream ).removeClass( 'cs-expanded' );
			$( button ).find( 'img' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-expand' ),
					src: this.imagepath + 'expand.png'
				} );
		},
		expandStream: function ( stream, button ) {
			stream.find( '.cs-reply-comment' ).removeClass( 'cs-hidden' );
			stream.find( '.cs-head-comment .cs-comment-body' ).removeClass( 'cs-hidden' );
			stream.find( '.cs-stream-footer .cs-reply-button' ).removeClass( 'cs-hidden' );
			$( stream ).addClass( 'cs-expanded' );
			$( stream ).removeClass( 'cs-collapsed' );
			$( button ).find( 'img' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-collapse' ),
					src: this.imagepath + 'collapse.png'
				} );
		},
		disableAllButtons: function () {
			$( '.cs-edit-button' ).prop( 'disabled', true );
			$( '.cs-reply-button' ).prop( 'disabled', true );
			$( '.cs-add-button' ).prop( 'disabled', true );
			$( '.cs-delete-button' ).prop( 'disabled', true );
			$( '.cs-toggle-button' ).prop( 'disabled', true );
			$( '.cs-link-button' ).prop( 'disabled', true );
			$( '.cs-vote-button' ).prop( 'disabled', true );
			$( '.cs-watch-button' ).prop( 'disabled', true );
		},
		enableAllButtons: function () {
			$( '.cs-edit-button' ).prop( 'disabled', false );
			$( '.cs-reply-button' ).prop( 'disabled', false );
			$( '.cs-add-button' ).prop( 'disabled', false );
			$( '.cs-delete-button' ).prop( 'disabled', false );
			$( '.cs-toggle-button' ).prop( 'disabled', false );
			$( '.cs-link-button' ).prop( 'disabled', false );
			$( '.cs-vote-button' ).prop( 'disabled', false );
			$( '.cs-watch-button' ).prop( 'disabled', false );
		},
		formatComment: function ( commentData ) {
			var self = this;
			var comment = this.formatCommentInner( commentData );

			if ( commentData.parentid === null ) {
				comment = $( '<div>' )
					.addClass( 'cs-stream' )
					.addClass( 'cs-expanded' )
					.attr( 'data-created-timestamp', commentData.created_timestamp )
					.append( comment );

				var streamFooter = $( '<div>' )
					.addClass( 'cs-stream-footer' );
				comment.append( streamFooter );

				if ( this.canComment ) {
					var replyButton = $( '<button>' )
						.addClass( 'cs-button' )
						.addClass( 'cs-reply-button' )
						.attr( {
							type: 'button',
							'data-stream-id': commentData.pageid,
							title: mw.message( 'commentstreams-buttontext-reply' ),
							'data-toggle': 'tooltip'
						} );
					var replyImage = $( '<img>' )
						.attr( {
							title: mw.message( 'commentstreams-buttontooltip-reply' ),
							src: this.imagepath + 'comment_reply.png'
						} );
					replyButton.append( replyImage );
					if ( this.showLabels ) {
						var replyLabel = $( '<span>' )
							.text( mw.message( 'commentstreams-buttontext-reply' ) )
							.addClass( 'cs-comment-button-label' );
						replyButton.append( replyLabel );
					}
					/* START Neayi : Don't use this.
					streamFooter.append( replyButton );
					END Neayi */
					replyButton.click( function () {
						var pageId = $( this ).attr( 'data-stream-id' );
						self.showNewReplyBox( $( this ), pageId );
					} );
				}
			}

			return comment;
		},
		formatCommentInner: function ( commentData ) {
			var self = this;
			var commentHeader = $( '<div>' )
				.addClass( 'cs-comment-header' );

			// Start Neayi: Add a few more classes
			commentData.features =  JSON.parse(commentData.features);
			commentHeader.addClass( 'd-flex flex-wrap' );
			// End Neayi
			
			var leftDiv = $( '<div>' )
				.addClass( 'cs-comment-header-left' );
			if ( commentData.avatar !== null && commentData.avatar.length > 0 ) {
				var avatar = $( '<img>' )
					.addClass( 'cs-avatar' )
					.attr( 'src', commentData.avatar );
				leftDiv.append( avatar );
			}
			commentHeader.append( leftDiv );

			var centerDiv = $( '<div>' )
				.addClass( 'cs-comment-header-center' );

			if ( commentData.parentid === null ) {
				var title = $( '<div>' )
					.addClass( 'cs-comment-title' )
					.text( commentData.commenttitle )
					.attr( {
						title: commentData.commenttitle,
						'data-toggle': 'tooltip'
					} );
					
				/* START Neayi: We'll move the title a little further down, just before the comment
				centerDiv.append( title );
				END Neayi */
			}

			/* START Neayi
			var author = $( '<span>' )
				.addClass( 'cs-comment-author' )
				.html( commentData.userdisplayname );
			centerDiv.append( author );
			END Neayi */

			// Start Neayi

			var author = $( '<div>' )
				.addClass( 'cs-comment-author' )
				.html( commentData.userdisplayname );
			centerDiv.append( author );

			var title = commentData.features['sector'];
			var structure = commentData.features['structure'];
			if (structure != '')
				structure = ' (<a href="/wiki/Structure:'+structure+'">'+structure+'</a>)';

			var authorTitle = $( '<div>' )
				.addClass( 'cs-comment-author-title' )
				.html( title + structure );
			centerDiv.append( authorTitle );

			// End Neayi


			var created = $( '<span>' )
				.addClass( 'cs-comment-details' )
				.text( mw.message( 'commentstreams-datetext-postedon' ) +
				' ' + commentData.created );
				
			/* START Neayi: We'll move the creation date a little further down, just before the title
			centerDiv.append( this.createDivider() );
			centerDiv.append( created );
			END Neayi */

			if ( commentData.modified !== null ) {
				var text = mw.message( 'commentstreams-datetext-lasteditedon' ) +
					' ' + commentData.modified;
				if ( commentData.moderated ) {
					text += ' (' + mw.message( 'commentstreams-datetext-moderated' ) +
						')';
				}

				// Start Neayi
				text = ' - ' + text;
				// End Neayi

				var modified = $( '<span>' )
					.addClass( 'cs-comment-details' )
					.text( text );

				/* START Neayi: We'll move the modification date a little further down, just before the title
				centerDiv.append( this.createDivider() );
				centerDiv.append( modified );
				END Neayi */
			}

			/* START Neayi: We'll build a special version of the contextual menu:
			var divider = this.createDivider();
			centerDiv.append( divider );

			if ( this.canEdit( commentData ) ) {
				centerDiv.append( this.createEditButton( commentData.username ) );
			}

			if ( this.canDelete( commentData ) ) {
				centerDiv.append( this.createDeleteButton( commentData.username ) );
			}

			centerDiv.append( this.createPermalinkButton( commentData.pageid ) );
			END Neayi */

			// Neayi: our context menu:
			var menulinks = Array();
			if ( this.canEdit( commentData ) ) {
				menulinks.push( this.createEditNeayiLink( commentData.username ) );
			}

			if ( this.canDelete( commentData ) ) {
				menulinks.push( this.createDeleteNeayiLink( commentData.username ) );
			}
			menulinks.push( this.createPermalinkNeayiLink( commentData.pageid ) );

			commentHeader.append( centerDiv );

			var rightDiv = $( '<div>' )
				.addClass( 'cs-comment-header-right' );

			if ( commentData.parentid === null && this.enableWatchlist &&
				this.isLoggedIn ) { // NEAYI : This was probably a bug. The user should be logged in in order to watch
				rightDiv.append( this.createWatchButton( commentData ) );
			}

			/* START Neayi: Remove the voting buttons from here
			if ( commentData.parentid === null && this.enableVoting ) {
				rightDiv.append( this.createVotingButtons( commentData ) );
			}
			END Neayi */

			if ( commentData.parentid === null ) {
				var collapseButton = $( '<button>' )
					.addClass( 'cs-button' )
					.addClass( 'cs-toggle-button' )
					.attr( 'type', 'button' );
				var collapseimage = $( '<img>' )
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-collapse' ),
						src: this.imagepath + 'collapse.png'
					} );
				collapseButton.append( collapseimage );
				/* START Neayi: We don't collapse
				rightDiv.append( collapseButton );
				END Neayi */
				collapseButton.click( function () {
					var stream = $( this ).closest( '.cs-stream' );
					if ( stream.hasClass( 'cs-expanded' ) ) {
						self.collapseStream( stream, this );
					} else {
						self.expandStream( stream, this );
					}
				} );
			}

			// START Neayi
			self.addFeatures( rightDiv, commentData.features['icons'] );
			// END Neayi

			commentHeader.append( rightDiv );

			// START Neayi
			commentHeader.append( self.createfeaturesExpandToggle( ) );
			// END Neayi

			var commentBody = $( '<div>' )
				.addClass( 'cs-comment-body' )
				.html( commentData.html );
			var commentFooter = $( '<div>' )
				.addClass( 'cs-comment-footer' );

			// Neayi reply button
			if (this.canComment) {
				var replyButton = $('<a>')
					.addClass('btn mr-2')
					.attr({
						'data-stream-id': commentData.pageid,
						title: mw.message('commentstreams-buttontext-reply'),
						'data-toggle': 'tooltip'
					});
					//
				if ( commentData.parentid === null ) {
					replyButton.addClass( 'btn btn-dark-green text-white mr-2' );
				} else {
					replyButton.addClass( 'btn btn btn-outline-gray mr-2 mb-md-0 mb-2' );
				}
		

				replyButton.append( this.createMaterialIcon('reply', '') );
				
				if (this.showLabels) {
					var replyLabel = $('<span>')
						.text(mw.message('commentstreams-buttontext-reply'))
						.addClass('cs-comment-button-label');
					replyButton.append(replyLabel);
				}

				commentFooter.append(replyButton);
				replyButton.click(function () {
					var pageId = $(this).attr('data-stream-id');
					self.showNewReplyBox($(this), pageId);
				});
			}

			// Neayi Ellipsis Menu
			this.addNeayiEllipsisMenu( commentFooter, 'dropdownMenuButton' + commentData.pageid, menulinks );

			if ( commentData.parentid === null && this.enableVoting ) {
				commentFooter.append( this.createNeayiVotingButtons( commentData ) );
			}
			// End Neayi Comment Footer

			var commentClass;
			if ( commentData.parentid !== null ) {
				commentClass = 'cs-reply-comment';
			} else {
				commentClass = 'cs-head-comment';
			}
			var id = 'cs-comment-' + commentData.pageid;
			// The following classes are used here:
			// * cs-reply-comment
			// * cs-head-comment
			var comment = $( '<div>' )
				.addClass( 'cs-comment' )
				.addClass( commentClass )
				.attr( {
					id: id,
					'data-id': commentData.pageid
				} );
			if ( this.targetComment === id ) {
				comment
					.addClass( 'cs-target-comment' );
			}
			
			/* START Neayi: We use our own order
			comment
				.append( [ commentHeader, commentBody, commentFooter ] );
			END Neayi */
			// START Neayi
			comment
				.append( [ commentHeader, created, modified, title, commentBody, commentFooter ] );
			// END Neayi
			
			return comment;
		},
		showUrlDialog: function ( id ) {
			var instructions =
				mw.message( 'commentstreams-urldialog-instructions' ).text();
			var textInput = new OO.ui.TextInputWidget( {
				value: this.baseUrl + '#' + id
			} );
			function UrlDialog( config ) {
				UrlDialog.super.call( this, config );
			}
			OO.inheritClass( UrlDialog, OO.ui.Dialog );
			UrlDialog.static.name = 'urlDialog';
			UrlDialog.static.title = 'Simple dialog';
			UrlDialog.prototype.initialize = function () {
				UrlDialog.super.prototype.initialize.call( this );
				this.content =
					new OO.ui.PanelLayout( { padded: true, expanded: false } );
				this.content.$element.append( '<p>' + instructions + '</p>' );
				this.content.$element.append( textInput.$element );
				this.$body.append( this.content.$element );
			};
			UrlDialog.prototype.getBodyHeight = function () {
				return this.content.$element.outerHeight( true );
			};
			var urlDialog = new UrlDialog( {
				size: 'medium'
			} );
			var windowManager = new OO.ui.WindowManager();
			$( 'body' ).append( windowManager.$element );
			windowManager.addWindows( [ urlDialog ] );
			windowManager.openWindow( urlDialog );
			textInput.select();
		},
		createEditButton: function ( username ) {
			var self = this;
			var editButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-edit-button' )
				.attr( {
					type: 'button',
					title: mw.message( 'commentstreams-buttontooltip-edit' ),
					'data-toggle': 'tooltip'
				} );
			
			var editimage = $( '<img>' );
			if ( mw.config.get( 'wgUserName' ) !== username ) {
				editimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-moderator-edit' ),
						src: this.imagepath + 'comment_moderator_edit.png'
					} );
				editButton
					.addClass( 'cs-moderator-button' );
			} else {
				editimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-edit' ),
						src: this.imagepath + 'comment_edit.png'
					} );
			}
			editButton.append( editimage );
			editButton.click( function () {
				var comment = $( this ).closest( '.cs-comment' );
				var pageId = $( comment ).attr( 'data-id' );
				self.editComment( $( comment ), pageId );
			} );
			return editButton;
		},
		createDeleteButton: function ( username ) {
			var self = this;
			var deleteButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-delete-button' )
				.attr( {
					type: 'button',
					title: mw.message( 'commentstreams-buttontooltip-delete' ),
					'data-toggle': 'tooltip'
				} );
			var deleteimage = $( '<img>' );
			if ( mw.config.get( 'wgUserName' ) !== username ) {
				deleteimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-moderator-delete' ),
						src: this.imagepath + 'comment_moderator_delete.png'
					} );
				deleteButton
					.addClass( 'cs-moderator-button' );
			} else {
				deleteimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-delete' ),
						src: this.imagepath + 'comment_delete.png'
					} );
			}
			deleteButton.append( deleteimage );
			deleteButton.click( function () {
				var comment = $( this ).closest( '.cs-comment' );
				var pageId = $( comment ).attr( 'data-id' );
				self.deleteComment( $( comment ), pageId );
			} );
			return deleteButton;
		},
		createPermalinkButton: function ( pageid ) {
			var self = this;
			var id = 'cs-comment-' + pageid;
			var permalinkButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-link-button' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-permalink' ),
					'data-toggle': 'tooltip'
				} )
				.on( 'click', function () {
					$( '.cs-target-comment' )
						.removeClass( 'cs-target-comment' );
					self.scrollToAnchor( id );
					var comment = $( this ).closest( '.cs-comment' );
					comment
						.addClass( 'cs-target-comment' );
					self.showUrlDialog( id );
					window.location.hash = '#' + id;
				} );
			var permalinkimage = $( '<img>' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-permalink' ),
					src: this.imagepath + 'link.png'
				} );
			permalinkButton.append( permalinkimage );
			return permalinkButton;
		},
		createWatchButton: function ( commentData ) {
			var self = this;
			var watchButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-watch-button' )
				.on( 'click', function () {
					self.watch( $( this ), commentData.pageid );
				} );
			var watchimage = $( '<img>' )
				.addClass( 'cs-watch-image' );
			if ( commentData.watching ) {
				watchimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-unwatch' ),
						src: this.imagepath + 'watching.png'
					} )
					.addClass( 'cs-watch-watching' );
			} else {
				watchimage
					.attr( {
						title: mw.message( 'commentstreams-buttontooltip-watch' ),
						src: this.imagepath + 'notwatching.png'
					} );
			}
			watchButton.append( watchimage );
			return watchButton;
		},
		createVotingButtons: function ( commentData ) {
			var self = this;

			var upButton;
			if ( this.isLoggedIn ) {
				upButton = $( '<button>' )
					.addClass( 'cs-button' )
					.addClass( 'cs-vote-button' )
					.on( 'click', function () {
						self.vote( $( this ), commentData.pageid, true,
							commentData.created_timestamp );
					} );
			} else {
				upButton = $( '<span>' )
					.addClass( 'cs-button' );
			}
			var upimage = $( '<img>' )
				.attr( 'title', mw.message( 'commentstreams-buttontooltip-upvote' ) )
				.addClass( 'cs-vote-upimage' );
			if ( commentData.vote > 0 ) {
				upimage.attr( 'src', this.imagepath + 'upvote-enabled.png' );
				upimage.addClass( 'cs-vote-enabled' );
			} else {
				upimage.attr( 'src', this.imagepath + 'upvote-disabled.png' );
			}
			var upcountspan = $( '<span>' )
				.addClass( 'cs-vote-upcount' )
				.text( commentData.numupvotes );
			upButton.append( upimage );
			upButton.append( upcountspan );

			var downButton;
			if ( this.isLoggedIn ) {
				downButton = $( '<button>' )
					.addClass( 'cs-button' )
					.addClass( 'cs-vote-button' )
					.on( 'click', function () {
						self.vote( $( this ), commentData.pageid, false,
							commentData.created_timestamp );
					} );
			} else {
				downButton = $( '<span>' )
					.addClass( 'cs-button' );
			}
			var downimage = $( '<img>' )
				.attr( 'title', mw.message( 'commentstreams-buttontooltip-downvote' ) )
				.addClass( 'cs-vote-downimage' );
			if ( commentData.vote < 0 ) {
				downimage.attr( 'src', this.imagepath + 'downvote-enabled.png' );
				downimage.addClass( 'cs-vote-enabled' );
			} else {
				downimage.attr( 'src', this.imagepath + 'downvote-disabled.png' );
			}
			var downcountspan = $( '<span>' )
				.addClass( 'cs-vote-downcount' )
				.text( commentData.numdownvotes );
			downButton.append( downimage );
			downButton.append( downcountspan );

			var votingSpan = $( '<span>' )
				.addClass( 'cs-voting-span' );
			votingSpan.append( upButton );
			votingSpan.append( downButton );
			return votingSpan;
		},
		vote: function ( button, pageid, up, created_timestamp ) {

			var self = this;
			var votespan = button.closest( '.cs-voting-span' );
			var upcountspan = votespan.find( '.cs-vote-upcount' );
			var upcount = parseInt( upcountspan.text() );
			var upimage = votespan.find( '.cs-vote-upimage' );
			var downcountspan = votespan.find( '.cs-vote-downcount' );
			var downcount = parseInt( downcountspan.text() );
			var downimage = votespan.find( '.cs-vote-downimage' );

			var newvote;
			if ( up ) {
				if ( upimage.hasClass( 'cs-vote-enabled' ) ) {
					newvote = 0;
				} else {
					newvote = 1;
				}
			} else {
				if ( downimage.hasClass( 'cs-vote-enabled' ) ) {
					newvote = 0;
				} else {
					newvote = -1;
				}
			}

			var comment = button.closest( '.cs-comment' );
			this.disableAllButtons();
			new Spinner( self.spinnerOptions )
				.spin( document.getElementById( comment.attr( 'id' ) ) );
			CommentStreamsQuerier.vote( pageid, newvote, function ( result ) {
				$( '.spinner' ).remove();
				if ( result.error === undefined ) {
					if ( up ) {
						if ( upimage.hasClass( 'cs-vote-enabled' ) ) {
							upimage.attr( 'src', self.imagepath + 'upvote-disabled.png' );
							upimage.removeClass( 'cs-vote-enabled' );
							upcount = upcount - 1;
							upcountspan.text( upcount );
						} else {
							upimage.attr( 'src', self.imagepath + 'upvote-enabled.png' );
							upimage.addClass( 'cs-vote-enabled' );
							upcount = upcount + 1;
							upcountspan.text( upcount );
							if ( downimage.hasClass( 'cs-vote-enabled' ) ) {
								downimage.attr( 'src', self.imagepath + 'downvote-disabled.png' );
								downimage.removeClass( 'cs-vote-enabled' );
								downcount = downcount - 1;
								downcountspan.text( downcount );
							}
						}
					} else {
						if ( downimage.hasClass( 'cs-vote-enabled' ) ) {
							downimage.attr( 'src', self.imagepath + 'downvote-disabled.png' );
							downimage.removeClass( 'cs-vote-enabled' );
							downcount = downcount - 1;
							downcountspan.text( downcount );
						} else {
							downimage.attr( 'src', self.imagepath + 'downvote-enabled.png' );
							downimage.addClass( 'cs-vote-enabled' );
							downcount = downcount + 1;
							downcountspan.text( downcount );
							if ( upimage.hasClass( 'cs-vote-enabled' ) ) {
								upimage.attr( 'src', self.imagepath + 'upvote-disabled.png' );
								upimage.removeClass( 'cs-vote-enabled' );
								upcount = upcount - 1;
								upcountspan.text( upcount );
							}
						}
					}
					var votediff = upcount - downcount;
					var stream = comment.closest( '.cs-stream' );
					self.adjustCommentOrder( stream, votediff, upcount,
						created_timestamp );
				} else {
					self.reportError( result.error );
					self.enableAllButtons();
				}
			} );
		},
		watch: function ( button, pageid ) {
			var self = this;
			var image = button.find( '.cs-watch-image' );
			var watchaction = !image.hasClass( 'cs-watch-watching' );
			var comment = button.closest( '.cs-comment' );
			this.disableAllButtons();
			new Spinner( self.spinnerOptions )
				.spin( document.getElementById( comment.attr( 'id' ) ) );
			CommentStreamsQuerier.watch( pageid, watchaction, function ( result ) {
				$( '.spinner' ).remove();
				if ( result.error === undefined ) {
					if ( watchaction ) {
						image
							.attr( {
								title: mw.message( 'commentstreams-buttontooltip-unwatch' ),
								src: self.imagepath + 'watching.png'
							} )
							.addClass( 'cs-watch-watching' );
					} else {
						image
							.attr( {
								title: mw.message( 'commentstreams-buttontooltip-watch' ),
								src: self.imagepath + 'notwatching.png'
							} )
							.removeClass( 'cs-watch-watching' );
					}
				} else {
					self.reportError( result.error );
				}
				self.enableAllButtons();
			} );
		},
		adjustCommentOrder: function ( stream, votediff, upcount,
			created_timestamp ) {
			var nextSiblings = stream.nextAll( '.cs-stream' );
			var first = true;
			var index;
			for ( index = 0; index < nextSiblings.length; index++ ) {
				var nextSibling = nextSiblings[ index ];
				var nextupcountspan =
					$( nextSibling ).find( '.cs-vote-upcount' );
				var nextupcount = parseInt( nextupcountspan.text() );
				var nextdowncountspan =
					$( nextSibling ).find( '.cs-vote-downcount' );
				var nextdowncount = parseInt( nextdowncountspan.text() );
				var nextvotediff = nextupcount - nextdowncount;
				if ( nextvotediff > votediff ) {
					// keeping looking
				} else if ( nextvotediff === votediff ) {
					if ( nextupcount > upcount ) {
						// keeping looking
					} else if ( nextupcount === upcount ) {
						var nextcreated_timestamp =
							$( nextSibling ).attr( 'data-created-timestamp' );
						if ( this.newestStreamsOnTop ) {
							if ( nextcreated_timestamp > created_timestamp ) {
								// keeping looking
							} else if ( first ) {
								// check previous siblings
								break;
							} else {
								this.moveComment( stream, true, $( nextSibling ) );
								return;
							}
						} else if ( nextcreated_timestamp < created_timestamp ) {
							// keep looking
						} else if ( first ) {
							// check previous siblings
							break;
						} else {
							this.moveComment( stream, true, $( nextSibling ) );
							return;
						}
					} else if ( first ) {
						// check previous siblings
						break;
					} else {
						this.moveComment( stream, true, $( nextSibling ) );
						return;
					}
				} else if ( first ) {
					// check previous siblings
					break;
				} else {
					this.moveComment( stream, true, $( nextSibling ) );
					return;
				}
				first = false;
			}
			if ( !first ) {
				this.moveComment( stream, false,
					$( nextSiblings[ nextSiblings.length - 1 ] ) );
				return;
			}
			var prevSiblings = stream.prevAll( '.cs-stream' );
			first = true;
			for ( index = 0; index < prevSiblings.length; index++ ) {
				var prevSibling = prevSiblings[ index ];
				var prevupcountspan =
					$( prevSibling ).find( '.cs-vote-upcount' );
				var prevupcount = parseInt( prevupcountspan.text() );
				var prevdowncountspan =
					$( prevSibling ).find( '.cs-vote-downcount' );
				var prevdowncount = parseInt( prevdowncountspan.text() );
				var prevvotediff = prevupcount - prevdowncount;
				if ( prevvotediff < votediff ) {
					// keeping looking
				} else if ( prevvotediff === votediff ) {
					if ( prevupcount < upcount ) {
						// keeping looking
					} else if ( prevupcount === upcount ) {
						var prevcreated_timestamp =
							$( prevSibling ).attr( 'data-created-timestamp' );
						if ( this.newestStreamsOnTop ) {
							if ( prevcreated_timestamp < created_timestamp ) {
								// keeping looking
							} else if ( first ) {
								// done
								break;
							} else {
								this.moveComment( stream, false, $( prevSibling ) );
								return;
							}
						} else if ( prevcreated_timestamp > created_timestamp ) {
							// keeping looking
						} else if ( first ) {
							// done
							break;
						} else {
							this.moveComment( stream, false, $( prevSibling ) );
							return;
						}
					} else if ( first ) {
						// done
						break;
					} else {
						this.moveComment( stream, false, $( prevSibling ) );
						return;
					}
				} else if ( first ) {
					// done
					break;
				} else {
					this.moveComment( stream, false, $( prevSibling ) );
					return;
				}
				first = false;
			}
			if ( !first ) {
				this.moveComment( stream, true,
					$( prevSiblings[ prevSiblings.length - 1 ] ) );
				return;
			}
			// otherwise, the comment was in the correct place already
			this.enableAllButtons();
		},
		moveComment: function ( stream, before, location ) {
			var self = this;
			stream.slideUp( 1000, function () {
				stream.detach();
				stream.hide();
				if ( before ) {
					stream.insertBefore( location );
				} else {
					stream.insertAfter( location );
				}
				stream.slideDown( 1000, function () {
					self.enableAllButtons();
					var id = $( this ).find( '.cs-head-comment:first' ).attr( 'id' );
					self.scrollToAnchor( id );
				} );
			} );
		},
		createDivider: function () {
			return $( '<span>' )
				.addClass( 'cs-comment-details' )
				.text( '|' );
		},
		formatEditBox: function ( is_stream ) {
			var commentBox = $( '<div>' )
				.addClass( 'cs-edit-box' )
				.attr( 'id', 'cs-edit-box' );

			if ( is_stream ) {
				var titleField = $( '<input>' )
					.attr( {
						id: 'cs-title-edit-field',
						type: 'text',
						placeholder: mw.message( 'commentstreams-title-field-placeholder' )
					} );
				commentBox.append( titleField );
			} else {
				commentBox.addClass( 'cs-reply-edit-box' );
			}

			if ( $.fn.applyVisualEditor ) {
				// VEForAll is installed.
				commentBox.addClass( 've-area-wrapper' );
			}

			var bodyField = $( '<textarea>' )
				.attr( {
					id: 'cs-body-edit-field',
					rows: 10,
					placeholder: mw.message( 'commentstreams-body-field-placeholder' )
				} );
			commentBox.append( bodyField );

			var submitButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-submit-button' )
				.attr( {
					id: 'cs-submit-button',
					type: 'button'
				} );
			var submitimage = $( '<img>' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-submit' ),
					src: this.imagepath + 'submit.png'
				} );
			submitButton.append( submitimage );

			commentBox.append( submitButton );

			var cancelButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-cancel-button' )
				.attr( {
					id: 'cs-cancel-button',
					type: 'button'
				} );
			var cancelimage = $( '<img>' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-cancel' ),
					src: this.imagepath + 'cancel.png'
				} );
			cancelButton.append( cancelimage );

			commentBox.append( cancelButton );

			return commentBox;
		},
		showNewCommentStreamBox: function ( addButton ) {
			var self = this;
			var editBox = this.formatNeayiEditBox( true );

			/* START Neayi

			var editBox = this.formatEditBox( true );

			if ( this.newestStreamsOnTop ) {
				$( addButton ).parent( '.cs-header' ).append( editBox );
				$( '#cs-edit-box' )
					.hide()
					.slideDown();
			} else {
				$( addButton ).parent( '.cs-footer' ).prepend( editBox );
				$( '#cs-edit-box' )
					.hide()
					.slideDown();
			}

			END Neayi */

			// Neayi : Always at the bottom
			$( addButton ).parent( '.cs-footer' ).prepend( editBox );
			$( '#cs-edit-box' )
				.hide()
				.slideDown();
			// END Neayi

			if ( $.fn.applyVisualEditor ) {
				// VEForAll is installed.
				var editField = $( '#cs-body-edit-field' );
				editField.applyVisualEditor();
			}
			$( '#cs-submit-button' ).on( 'click', function () {
				self.postComment( null, $( addButton ).parents( '.cs-comments' ).attr( 'id' ) );
			} );
			$( '#cs-cancel-button' ).on( 'click', function () {
				self.hideEditBox( true );
			} );
			this.disableAllButtons();
			var titleField = $( '#cs-title-edit-field' );
			if ( titleField !== null ) {
				titleField.focus();
			}
		},
		showNewReplyBox: function ( element, topCommentId ) {
			var self = this;
			var editBox = this.formatNeayiEditBox( false );
			
			/* START Neayi
			var editBox = this.formatEditBox( false );
			$( editBox )
				.insertBefore( element.closest( '.cs-stream-footer' ) )
				.hide()
				.slideDown();
			END Neayi */
			// Start Neayi:
			$( editBox )
				.insertBefore( element.closest( '.cs-stream' ).children( ".cs-stream-footer" ) )
				.hide()
				.slideDown();
			// END Neayi
			
			$( '#cs-submit-button' ).on( 'click', function () {
				self.postComment( topCommentId, '0' );
			} );
			$( '#cs-cancel-button' ).on( 'click', function () {
				self.hideEditBox( true );
			} );
			this.disableAllButtons();
			var editField = $( '#cs-body-edit-field' );
			if ( editField !== null ) {
				editField.focus();
				if ( $.fn.applyVisualEditor ) {
					// VEForAll is installed.
					editField.applyVisualEditor();
				}
			}
		},
		hideEditBox: function ( animated ) {
			if ( animated ) {
				$( '#cs-edit-box' ).slideUp( 'normal', function () {
					$( '#cs-edit-box' ).remove();
				} );
			} else {
				$( '#cs-edit-box' ).remove();
			}
			this.enableAllButtons();
		},
		postComment: function ( parentPageId, cst_id ) {
			var self = this;
			if ( this.isLoggedIn ) {
				self.postComment2( parentPageId, cst_id );
			} else {
				var message_text =
					mw.message( 'commentstreams-dialog-anonymous-message' ).text();
				var ok_text =
					mw.message( 'commentstreams-dialog-buttontext-ok' ).text();
				var cancel_text =
					mw.message( 'commentstreams-dialog-buttontext-cancel' ).text();
				var dialog = new OO.ui.MessageDialog();
				var window_manager = new OO.ui.WindowManager();
				$( '.cs-comments' ).append( window_manager.$element );
				window_manager.addWindows( [ dialog ] );
				window_manager.openWindow( dialog, {
					message: message_text,
					actions: [
						{ label: ok_text, action: 'ok' },
						{ label: cancel_text, flags: 'primary' }
					]
				} ).closed.then( function ( data ) {
					if ( data && data.action && data.action === 'ok' ) {
						self.postComment2( parentPageId, cst_id );
					}
				} );
			}

			// Neayi - Follow the page
			if (window.NeayiInteractionsController)
				window.NeayiInteractionsController.ajaxInsights(['follow']);
			// End Neayi
		},
		postComment2: function ( parentPageId, cst_id ) {
			var self = this;
			if ( $( '#cs-body-edit-field' ).css( 'display' ) === 'none' ) {
				self.postCommentFromVE( parentPageId, cst_id );
			} else {
				var commentText = $( '#cs-body-edit-field' ).val();
				self.realPostComment( parentPageId, cst_id, commentText );
			}
		},
		postCommentFromVE: function ( parentPageId, cst_id ) {
			var self = this;
			var editField = $( '#cs-body-edit-field' );
			var veInstances = editField.getVEInstances();
			var curVEEditor = veInstances[ veInstances.length - 1 ];
			new mw.Api().post( {
				action: 'veforall-parsoid-utils',
				from: 'html',
				to: 'wikitext',
				content: curVEEditor.target.getSurface().getHtml(),
				title: mw.config.get( 'wgPageName' ).split( /(\\|\/)/g ).pop()
			} ).then( function ( data ) {
				var commentText = data[ 'veforall-parsoid-utils' ].content;
				self.realPostComment( parentPageId, cst_id, commentText );
			} )
				.fail( function () {
					self.reportError( 'commentstreams-ve-conversion-error' );
				} );
		},
		realPostComment: function ( parentPageId, cst_id, commentText ) {
			var self = this;

			var commentTitle;
			if ( parentPageId === null ) {
				var titleField = $( '#cs-title-edit-field' );
				if ( titleField !== null ) {
					commentTitle = titleField.val();
					if ( commentTitle === null || commentTitle.trim() === '' ) {
						this.reportError( 'commentstreams-validation-error-nocommenttitle' );
						return;
					}
				}
			} else {
				commentTitle = null;
			}

			if ( commentText === null || commentText.trim() === '' ) {
				this.reportError( 'commentstreams-validation-error-nocommenttext' );
				return;
			}

			$( '#cs-submit-button' ).prop( 'disabled', true );
			$( '#cs-cancel-button' ).prop( 'disabled', true );

			$( '#cs-edit-box' ).fadeTo( 100, 0.2, function () {
				new Spinner( self.spinnerOptions )
					.spin( document.getElementById( 'cs-edit-box' ) );

				var associatedPageId = mw.config.get( 'wgArticleId' );
				CommentStreamsQuerier.postComment( commentTitle, commentText,
					associatedPageId, parentPageId, cst_id, function ( result ) {
						$( '.spinner' ).remove();
						if ( result.error === undefined ) {
							var comment = self.formatComment( result );
							if ( parentPageId ) {
								if ( !self.moderatorFastDelete ) {
									var deleteSpan = $( '#cs-edit-box' )
										.closest( '.cs-stream' )
										.find( '.cs-head-comment' )
										.find( '.cs-comment-header' )
										.find( '.cs-delete-button' );
									deleteSpan.remove();
								}
								var location = $( '#cs-edit-box' )
									.closest( '.cs-stream' )
									.find( '.cs-stream-footer' );
								self.hideEditBox( false );
								comment.insertBefore( $( location ) )
									.hide()
									.slideDown();
							} else {
								self.hideEditBox( false );
								if ( self.newestStreamsOnTop ) {
									comment.insertAfter( '#' + cst_id + ' .cs-header' )
										.hide()
										.slideDown();
								} else {
									comment.insertBefore( '#' + cst_id + ' .cs-footer' )
										.hide()
										.slideDown();
								}
								self.adjustCommentOrder( comment, 0, 0,
									result.created_timestamp );
							}
						} else {
							self.reportError( result.error );
							$( '#cs-edit-box' ).fadeTo( 0.2, 100, function () {
								$( '#cs-submit-button' ).prop( 'disabled', false );
								$( '#cs-cancel-button' ).prop( 'disabled', false );
							} );
						}
					} );
			} );
		},
		deleteComment: function ( element, pageId ) {
			var self = this;
			var message_text =
				mw.message( 'commentstreams-dialog-delete-message' ).text();
			var yes_text =
				mw.message( 'commentstreams-dialog-buttontext-yes' ).text();
			var no_text =
				mw.message( 'commentstreams-dialog-buttontext-no' ).text();
			var dialog = new OO.ui.MessageDialog();
			var window_manager = new OO.ui.WindowManager();
			$( '.cs-comments' ).append( window_manager.$element );
			window_manager.addWindows( [ dialog ] );
			window_manager.openWindow( dialog, {
				message: message_text,
				actions: [
					{ label: yes_text, action: 'yes' },
					{ label: no_text, flags: 'primary' }
				]
			} ).closed.then( function ( data ) {
				if ( data && data.action && data.action === 'yes' ) {
					self.realDeleteComment( element, pageId );
				}
			} );
		},
		realDeleteComment: function ( element, pageId ) {
			var self = this;
			this.disableAllButtons();
			element.fadeTo( 100, 0.2, function () {
				new Spinner( self.spinnerOptions )
					.spin( document.getElementById( element.attr( 'id' ) ) );
				CommentStreamsQuerier.deleteComment( pageId, function ( result ) {
					$( '.spinner' ).remove();
					if ( result.error === undefined ||
						result.error === 'commentstreams-api-error-commentnotfound' ) {
						if ( element.hasClass( 'cs-head-comment' ) ) {
							element.closest( '.cs-stream' )
								.slideUp( 'normal', function () {
									element.closest( '.cs-stream' ).remove();
									self.enableAllButtons();
								} );
						} else {
							var parentId = element
								.closest( '.cs-stream' )
								.find( '.cs-head-comment' )
								.attr( 'data-id' );
							CommentStreamsQuerier.queryComment( parentId, function ( queryResult ) {
								if ( queryResult.error === undefined &&
									self.canDelete( queryResult ) &&
									!self.moderatorFastDelete ) {
									self.createDeleteButton( queryResult.username )
										.insertAfter( element
											.closest( '.cs-stream' )
											.find( '.cs-head-comment' )
											.find( '.cs-comment-header' )
											.find( '.cs-edit-button' ) );
								}
								element.slideUp( 'normal', function () {
									element.remove();
									self.enableAllButtons();
								} );
							} );
						}
					} else {
						self.reportError( result.error );
						element.fadeTo( 0.2, 100, function () {
							self.enableAllButtons();
						} );
					}
				} );
			} );
		},
		editComment: function ( element, pageId ) {
			var self = this;
			this.disableAllButtons();
			element.fadeTo( 100, 0.2, function () {
				new Spinner( self.spinnerOptions )
					.spin( document.getElementById( element.attr( 'id' ) ) );
				CommentStreamsQuerier.queryComment( pageId, function ( result ) {
					$( '.spinner' ).remove();

					if ( result.error === undefined ) {
						var is_stream = element.hasClass( 'cs-head-comment' );
						// var commentBox = self.formatEditBox( is_stream );

						// NEAYI
						var commentBox = self.formatNeayiEditBox( is_stream );

						commentBox.insertAfter( element );
						element.hide();
						commentBox.slideDown();

						var editField = $( '#cs-body-edit-field' );
						editField.val( $( '<textarea/>' ).html( result.wikitext ).text() );
						if ( is_stream ) {
							var titleField = $( '#cs-title-edit-field' );
							titleField.val( result.commenttitle );
							titleField.focus();
						} else {
							editField.focus();
						}
						if ( $.fn.applyVisualEditor ) {
							// VEForAll is installed.
							editField.applyVisualEditor();
						}

						$( '#cs-cancel-button' ).on( 'click', function () {
							commentBox.slideUp( 'normal', function () {
								element.fadeTo( 0.2, 100, function () {
									commentBox.remove();
									self.enableAllButtons();
								} );
							} );
						} );

						$( '#cs-submit-button' ).on( 'click', function () {
							if ( $( '#cs-body-edit-field' ).css( 'display' ) === 'none' ) {
								self.editCommentFromVE( element, commentBox, pageId );
							} else {
								var commentText = $( '#cs-body-edit-field' ).val();
								self.realEditComment( element, commentBox, pageId, commentText );
							}
						} );
					} else if ( result.error === 'commentstreams-api-error-commentnotfound' ) {
						self.reportError( result.error );
						var parentId = element
							.closest( '.cs-stream' )
							.find( '.cs-head-comment' )
							.attr( 'data-id' );
						CommentStreamsQuerier.queryComment( parentId, function ( queryResult ) {
							if ( queryResult.error === undefined &&
								self.canDelete( queryResult ) &&
								!self.moderatorFastDelete ) {
								self.createDeleteButton( queryResult.username )
									.insertAfter( element
										.closest( '.cs-stream' )
										.find( '.cs-head-comment' )
										.find( '.cs-comment-header' )
										.find( '.cs-edit-button' ) );
							}
							element.remove();
							self.enableAllButtons();
						} );
					} else {
						self.reportError( result.error );
						element.fadeTo( 0.2, 100, function () {
							self.enableAllButtons();
						} );
					}
				} );
			} );
		},
		editCommentFromVE: function ( element, commentBox, pageId ) {
			var self = this;
			var editField = $( '#cs-body-edit-field' );
			var veInstances = editField.getVEInstances();
			var curVEEditor = veInstances[ veInstances.length - 1 ];
			new mw.Api().post( {
				action: 'veforall-parsoid-utils',
				from: 'html',
				to: 'wikitext',
				content: curVEEditor.target.getSurface().getHtml(),
				title: mw.config.get( 'wgPageName' ).split( /(\\|\/)/g ).pop()
			} ).then( function ( data ) {
				var commentText = data[ 'veforall-parsoid-utils' ].content;
				self.realEditComment( element, commentBox, pageId, commentText );
			} )
				.fail( function () {
					self.reportError( 'commentstreams-ve-conversion-error' );
				} );
		},
		realEditComment: function ( element, commentBox, pageId, commentText ) {
			var self = this;
			if ( element.hasClass( 'cs-head-comment' ) ) {
				var commentTitle = $( '#cs-title-edit-field' ).val();
				if ( commentTitle === null || commentTitle.trim() === '' ) {
					self.reportError(
						'commentstreams-validation-error-nocommenttitle' );
					return;
				}
			}

			if ( commentText === null || commentText.trim() === '' ) {
				self.reportError(
					'commentstreams-validation-error-nocommenttext' );
				return;
			}

			$( '#cs-submit-button' ).prop( 'disabled', true );
			$( '#cs-cancel-button' ).prop( 'disabled', true );

			commentBox.fadeTo( 100, 0.2, function () {
				new Spinner( self.spinnerOptions )
					.spin( document.getElementById( 'cs-edit-box' ) );

				CommentStreamsQuerier.editComment( commentTitle, commentText,
					pageId, function ( result ) {
						$( '.spinner' ).remove();
						if ( result.error === undefined ) {
							var comment = self.formatCommentInner( result );
							if ( element.closest( '.cs-stream' ).hasClass( 'cs-collapsed' ) ) {
								comment.find( '.cs-comment-body' ).addClass( 'cs-hidden' );
							}
							commentBox.slideUp( 'normal', function () {
								comment.insertAfter( commentBox );
								commentBox.remove();
								element.remove();
								self.enableAllButtons();
							} );
						} else if ( result.error === 'commentstreams-api-error-commentnotfound' ) {
							self.reportError( result.error );
							var parentId = element
								.closest( '.cs-stream' )
								.find( '.cs-head-comment' )
								.attr( 'data-id' );
							CommentStreamsQuerier.queryComment( parentId, function ( queryResult ) {
								if ( queryResult.error === undefined &&
								self.canDelete( queryResult ) &&
								!self.moderatorFastDelete ) {
									self.createDeleteButton( queryResult.username )
										.insertAfter( element
											.closest( '.cs-stream' )
											.find( '.cs-head-comment' )
											.find( '.cs-comment-header' )
											.find( '.cs-edit-button' ) );
								}
								commentBox.slideUp( 'normal', function () {
									commentBox.remove();
									element.remove();
									self.enableAllButtons();
								} );
							} );
						} else {
							self.reportError( result.error );
							commentBox.fadeTo( 0.2, 100, function () {
								$( '#cs-submit-button' ).prop( 'disabled', false );
								$( '#cs-cancel-button' ).prop( 'disabled', false );
							} );
						}
					} );
			} );
		},
		canEdit: function ( comment ) {
			var username = comment.username;
			if ( this.isLoggedIn && ( mw.config.get( 'wgUserName' ) === username ||
				this.moderatorEdit ) ) {
				return true;
			}
			return false;
		},
		canDelete: function ( comment ) {
			var username = comment.username;
			if ( this.isLoggedIn && ( mw.config.get( 'wgUserName' ) === username ||
				this.moderatorDelete ) &&
				( comment.numreplies === 0 || this.moderatorFastDelete ) ) {
				return true;
			}
			return false;
		},
		reportError: function ( message ) {
			/* eslint-disable mediawiki/msg-doc */
			var message_text = mw.message( message ).text();
			var ok_text = mw.message( 'commentstreams-dialog-buttontext-ok' ).text();
			var dialog = new OO.ui.MessageDialog();
			var window_manager = new OO.ui.WindowManager();
			$( '.cs-comments' ).append( window_manager.$element );
			window_manager.addWindows( [ dialog ] );
			window_manager.openWindow( dialog, {
				message: message_text,
				actions: [ {
					action: 'accept',
					label: ok_text,
					flags: 'primary'
				} ]
			} );
		},

		// Neayi functions

		addNeayiEllipsisMenu: function ( parentElement, menuID, menulinks, addMarginOnLeft ) {
			var menuDiv = $( '<div>' )
				.addClass( 'dropdown d-inline-block mr-2' );

			var subMenuButton = $( '<button>' )
				.addClass( 'btn btn-outline-darkgreen dropdown-toggle text-dark-green no-caret px-2' )
				.attr( {
					id: menuID,
					'type': "button",
					'data-toggle': "dropdown",
					'aria-haspopup': true,
					'aria-expanded': false
				} );

			subMenuButton.append( this.createMaterialIcon('more_vert', '') );

			menuDiv.append( subMenuButton );

			var submenuDiv = $( '<div>' )
				.addClass( 'dropdown-menu' )
				.attr( {
					'aria-labelledby': menuID
				} );
			menuDiv.append( submenuDiv );

			menulinks.forEach(item => submenuDiv.append(item));

			parentElement.append( menuDiv );
		},		
		createNeayiAddButton: function ()
		{
			var self = this;

			var addButtonDiv = $( '<div> ' )
			.addClass( 'cs-add-div' );

			var addButton = $( '<button>' )
				.attr( {
					type: 'button',
					class: 'cs-add-button',
					title: mw.message( 'commentstreams-buttontext-Neayi-askquestion' ),
					'data-toggle': 'tooltip'
				} )
				.addClass( 'cs-button rounded' );
			
			var addCommentFA = $( '<i>' )
				.addClass( 'fas fa-comment' );
			addButton.append( addCommentFA );

			if ( self.showLabels ) {
				var addLabel = $( '<span>' )
					.text( mw.message( 'commentstreams-buttontext-Neayi-askquestion' ) )
					.addClass( 'cs-comment-button-label' );
				addButton.append( addLabel );
			}

			addButtonDiv.append( addButton );

			return addButtonDiv;
		},
		createEditNeayiLink: function ( username ) {
			var self = this;
			var editButton = $( '<a>' )
				.addClass( 'dropdown-item' );

			editButton.append( this.createMaterialIcon('edit', 'mr-2') );

			var editText = $( '<span>' )
				.text( mw.message( 'commentstreams-buttontext-Neayi-edit' ) );
			editButton.append( editText );

			editButton.click( function () {
				var comment = $( this ).closest( '.cs-comment' );
				var pageId = $( comment ).attr( 'data-id' );
				self.editComment( $( comment ), pageId );
			} );
			return editButton;
		},

		createDeleteNeayiLink: function ( username ) {
			var self = this;
			var deleteButton = $( '<a>' )
				.addClass( 'dropdown-item' );

			deleteButton.append( this.createMaterialIcon('delete', 'mr-2') );

			var deleteText = $( '<span>' )
				.text( mw.message( 'commentstreams-buttontext-Neayi-delete' ) );
			deleteButton.append( deleteText );

			deleteButton.click( function () {
				var comment = $( this ).closest( '.cs-comment' );
				var pageId = $( comment ).attr( 'data-id' );
				self.deleteComment( $( comment ), pageId );
			} );
			return deleteButton;
		},
		

		createPermalinkNeayiLink: function ( pageid ) {
			var self = this;
			var id = 'cs-comment-' + pageid;
			var permalinkButton = $( '<a>' )
				.addClass( 'dropdown-item' )
				.on( "click", function () {
					$( '.cs-target-comment' )
						.removeClass( 'cs-target-comment' );
					self.scrollToAnchor( id );
					var comment = $( this ).closest( '.cs-comment' );
					comment
						.addClass( 'cs-target-comment' );
					self.showUrlDialog( id );
					window.location.hash = '#' + id;
				} );

			permalinkButton.append( this.createMaterialIcon('link', 'mr-2') );

			var getLinkText = $( '<span>' )
				.text( mw.message( 'commentstreams-buttontext-Neayi-permalink' ) );
			permalinkButton.append( getLinkText );

			return permalinkButton;
		},
		createMaterialIcon: function ( iconId, additionalClasses ) {
			var iconSpan = $( '<span>' )
			.addClass( 'material-icons' )
			.addClass( additionalClasses )
			.attr( {
				'aria-hidden': 'true'
			} )
			.text(iconId);

			return iconSpan;
		},
		createNeayiVotingButtons: function ( commentData ) {
			var self = this;

			var upButton;
			if ( this.isLoggedIn ) {
				upButton = $( '<button>' )
					.addClass( 'btn btn-outline-gray' )
					.on( 'click', function () {
						self.vote( $( this ), commentData.pageid, true,
							commentData.created_timestamp );
					} );
			} else {
				upButton = $( '<span>' )
					.addClass( 'btn btn-outline-gray' );
			}

			if ( commentData.vote < 0 ) {
				upButton.append( this.createMaterialIcon( 'keyboard_arrow_up', 'cs-vote-upimage cs-vote-enabled') );
			}
			else {
				upButton.append( this.createMaterialIcon( 'keyboard_arrow_up', 'cs-vote-upimage') );
			}

			var upcountspan = $( '<span>' )
				.addClass( 'cs-vote-upcount' )
				.text( commentData.numupvotes );
			upButton.append( upcountspan );

			var downButton;
			if ( this.isLoggedIn ) {
				downButton = $( '<button>' )
					.addClass( 'btn btn-outline-gray' )
					.on( 'click', function () {
						self.vote( $( this ), commentData.pageid, false,
							commentData.created_timestamp );
					} );
			} else {
				downButton = $( '<span>' )
					.addClass( 'btn btn-outline-gray' );
			}
			
			if ( commentData.vote < 0 ) {
				downButton.append( this.createMaterialIcon( 'keyboard_arrow_down', 'cs-vote-upimage cs-vote-enabled') );
			}
			else {
				downButton.append( this.createMaterialIcon( 'keyboard_arrow_down', 'cs-vote-upimage') );
			}

			var downcountspan = $( '<span>' )
				.addClass( 'cs-vote-downcount' )
				.text( commentData.numdownvotes );
			downButton.append( downcountspan );

			var votingDiv = $( '<div>' )
				.addClass( 'btn-group cs-voting-span' )
				.attr( {
					'role': 'group',
					'aria-label': ''
				} );

			votingDiv.append( upButton );
			votingDiv.append( downButton );
			return votingDiv;
		},
		formatNeayiEditBox: function ( is_stream ) {

			var commentBox = $( '<div>' )
				.addClass( 'cs-edit-box px-2' )
				.attr( 'id', 'cs-edit-box' );

			if ( is_stream ) {
				var titleField = $( '<input>' )
					.attr( {
						id: 'cs-title-edit-field',
						type: 'text',
						placeholder: mw.message( 'commentstreams-title-field-placeholder' )
					} );
				commentBox.append( titleField );
			} else {
				commentBox.addClass( 'cs-reply-edit-box' );
			}

			if ( $.fn.applyVisualEditor ) {
				// VEForAll is installed.
				commentBox.addClass( 've-area-wrapper' );
			}

			var bodyField = $( '<textarea>' )
				.attr( {
					id: 'cs-body-edit-field',
					rows: 10,
					placeholder: mw.message( 'commentstreams-body-field-placeholder' )
				} );
			commentBox.append( bodyField );

			var submitButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-submit-button' )
				.attr( {
					id: 'cs-submit-button',
					type: 'button'
				} );
			var submitimage = $( '<img>' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-submit' ),
					src: this.imagepath + 'submit.png'
				} );
			submitButton.append( submitimage );

			commentBox.append( submitButton );

			var cancelButton = $( '<button>' )
				.addClass( 'cs-button' )
				.addClass( 'cs-cancel-button' )
				.attr( {
					id: 'cs-cancel-button',
					type: 'button'
				} );
			var cancelimage = $( '<img>' )
				.attr( {
					title: mw.message( 'commentstreams-buttontooltip-cancel' ),
					src: this.imagepath + 'cancel.png'
				} );
			cancelButton.append( cancelimage );

			commentBox.append( cancelButton );

			return commentBox;
		},		

		addFeatures: function ( rightDiv, features ) {
		
			rightDiv.addClass("flex-fill caracteristiques"); // Flex-fill: takes as much space as available
			var rowDiv = $( '<div>' )
				.addClass( 'caracteristiques-bloc d-flex flex-wrap' );
			rightDiv.append( rowDiv );

			var featureIndex;
			for ( featureIndex in features ) {
				var aFeature = features[ featureIndex ];
				
				// Available: 
				// aFeature.url (page URL)
				// aFeature.icon (icon URL)
				// aFeature.caption (text to display next to the icon)

				var carDiv = $( '<div>' )
					.addClass( 'd-flex mr-1' );
				
				if (aFeature.url)
				{
					var imageLink = $( '<a>')
					.attr( {
						'href': aFeature.url,
					})
					.addClass( 'align-self-center d-flex' );

					carDiv.append( imageLink );
				}
				else
					imageLink = carDiv;

				if (aFeature.icon)
				{
					var carImage = $( '<img>' )
						.attr( {
							title: aFeature.caption,
							src: aFeature.icon
						} )
						.addClass( 'd-inline-block align-self-center' );
					imageLink.append( carImage );
				}

				var carSpan = $( '<span>' )
					.addClass( 'align-self-center' )
					.text( aFeature.caption );
				imageLink.append( carSpan );

				rowDiv.append( carDiv );
			}
		},

		createfeaturesExpandToggle: function ( rightDiv, features ) {

			var toggleDiv = $( '<div>' )
				.addClass( 'text-right show-all' );
			var toggleLink = $('<a>')
				.attr({
					href: 'javascript:void(0)',
				});			

			var toggleSpan = $( '<span>' )
				.addClass( 'material-icons mt-3' )
				.text( 'keyboard_arrow_down' );
			toggleLink.append( toggleSpan );

			toggleDiv.append( toggleLink );

			return toggleDiv;
		}			
	};
}() );

window.CommentStreamsController = commentstreams_controller;

( function () {
	$( document )
		.ready( function () {
			if ( mw.config.exists( 'CommentStreams' ) ) {
				window.CommentStreamsController.initialize();
			}
		} );
}() );



$(document).ready(function () {

	// show/hide overflow

	$('.show-all a').each(function () {

		$(this).click(function () {
			var currentBlock = $(this).parents('.cs-comment-header');
			currentBlock.toggleClass('expanded');
			if (currentBlock.hasClass('expanded')) {
				$(this).find('span').text('keyboard_arrow_up');
			}
			else if (!currentBlock.hasClass('expanded')) {
				$(this).find('span').text('keyboard_arrow_down');
			}
		});

	});

});