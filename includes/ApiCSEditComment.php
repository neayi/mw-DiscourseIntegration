<?php
/*
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

class ApiCSEditComment extends ApiCSBase {

	/**
	 * @param ApiMain $main main module
	 * @param string $action name of this module
	 */
	public function __construct( $main, $action ) {
		parent::__construct( $main, $action, true );
	}

	/**
	 * the real body of the execute function
	 *
	 * @param Comment $comment the comment to execute the action upon
	 * @return result of API request
	 */
	protected function executeBody( $comment ) {
		if ( !$comment->getWikiPage()->getTitle()->userCan( 'edit',
			$this->getUser() ) ) {
			$this->dieCustomUsageMessage(
				'commentstreams-api-error-edit-permissions' );
		}

		$comment_title = $this->getMain()->getVal( 'commenttitle' );
		$wikitext = $this->getMain()->getVal( 'wikitext' );

		if ( is_null( $comment->getParentId() ) && is_null( $comment_title ) ) {
			$this->dieCustomUsageMessage(
				'commentstreams-api-error-missingcommenttitle' );
		}

		$result = $comment->update( $comment_title, $wikitext );
		if ( !$result ) {
			$this->dieCustomUsageMessage( 'commentstreams-api-error-edit' );
		}

		$this->getResult()->addValue( null, $this->getModuleName(),
			$comment->getJSON() );
	}

	/**
	 * @return array allowed paramters
	 */
	public function getAllowedParams() {
		return array_merge( parent::getAllowedParams(),
			[
				'commenttitle' =>
					[
						ApiBase::PARAM_TYPE => 'string',
						ApiBase::PARAM_REQUIRED => false
					],
				'wikitext' =>
					[
						ApiBase::PARAM_TYPE => 'string',
						ApiBase::PARAM_REQUIRED => true
					]
			]
		);
	}

	/**
	 * @return array examples of the use of this API module
	 */
	public function getExamplesMessages() {
		return [];
	}

	/**
	 * @return string indicates that this API module requires a CSRF toekn
	 */
	public function needsToken() {
		return 'csrf';
	}
}
